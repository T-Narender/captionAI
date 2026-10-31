"""Evaluate CaptionAI's live SER endpoint on local RAVDESS or CREMA-D WAV files.

Datasets are not downloaded by this script. It uses the unfiltered top class
from each response's modelComparison.existing.scores to measure the model,
separately counting predictions rejected by the current live confidence gate.
"""

from __future__ import annotations

import argparse
import json
import random
import urllib.error
import urllib.request
import wave
from collections import Counter
from io import BytesIO
from pathlib import Path

import numpy as np

LABELS = ("angry", "happy", "neutral", "sad")
RAVDESS_LABELS = {"01": "neutral", "03": "happy", "04": "sad", "05": "angry"}
CREMA_LABELS = {"ANG": "angry", "HAP": "happy", "NEU": "neutral", "SAD": "sad"}


def dataset_label(path: Path, dataset: str) -> str | None:
    parts = path.stem.split("-") if dataset == "ravdess" else path.stem.split("_")
    if dataset == "ravdess":
        # RAVDESS: retain audio-only speech (not songs) and the four SER classes.
        if len(parts) < 7 or parts[0] != "03" or parts[1] != "01":
            return None
        return RAVDESS_LABELS.get(parts[2])
    if len(parts) < 4:
        return None
    return CREMA_LABELS.get(parts[2].upper())


def as_16khz_wav(path: Path) -> bytes:
    with wave.open(str(path), "rb") as audio_file:
        if audio_file.getsampwidth() != 2 or audio_file.getcomptype() != "NONE":
            raise ValueError("expected uncompressed 16-bit PCM WAV")
        sample_rate = audio_file.getframerate()
        channels = audio_file.getnchannels()
        frames = audio_file.readframes(audio_file.getnframes())

    if sample_rate < 8000 or sample_rate > 96000 or channels < 1:
        raise ValueError("unsupported sample rate or channel count")
    samples = np.frombuffer(frames, dtype="<i2").astype(np.float32)
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)
    if sample_rate != 16000 and samples.size:
        target_size = max(1, round(samples.size * 16000 / sample_rate))
        old_positions = np.arange(samples.size, dtype=np.float32)
        new_positions = np.linspace(0, samples.size - 1, target_size, dtype=np.float32)
        samples = np.interp(new_positions, old_positions, samples)
    samples = np.clip(np.rint(samples), -32768, 32767).astype("<i2")

    output = BytesIO()
    with wave.open(output, "wb") as audio_file:
        audio_file.setnchannels(1)
        audio_file.setsampwidth(2)
        audio_file.setframerate(16000)
        audio_file.writeframes(samples.tobytes())
    return output.getvalue()


def request_scores(service_url: str, audio: bytes, timeout: float) -> dict:
    request = urllib.request.Request(
        f"{service_url.rstrip('/')}/emotion?language=en",
        data=audio,
        headers={"Content-Type": "audio/wav"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def summarize_confusion(confusion: Counter, actual_counts: Counter, labels: tuple[str, ...]) -> dict:
    scored = sum(confusion.values())
    correct = sum(confusion[(label, label)] for label in labels)
    return {
        "scored": scored,
        "topClassAccuracy": round(correct / scored, 3) if scored else None,
        "perClass": {
            label: {
                "correct": confusion[(label, label)],
                "total": actual_counts[label],
                "recall": round(confusion[(label, label)] / actual_counts[label], 3)
                if actual_counts[label] else None,
            }
            for label in labels
        },
        "confusionMatrix": {
            actual: {predicted: confusion[(actual, predicted)] for predicted in labels}
            for actual in labels
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", choices=("ravdess", "crema-d"))
    parser.add_argument("audio_dir", type=Path, help="Root directory containing the extracted WAV files")
    parser.add_argument("--service-url", default="http://127.0.0.1:8000")
    sample_options = parser.add_mutually_exclusive_group()
    sample_options.add_argument("--limit", type=int, default=0, help="Evaluate the first N matching clips; 0 means all")
    sample_options.add_argument(
        "--sample-per-class",
        type=int,
        default=0,
        help="Randomly sample this many clips per label with a fixed seed",
    )
    parser.add_argument("--timeout", type=float, default=60)
    args = parser.parse_args()

    if not args.audio_dir.is_dir():
        parser.error(f"audio directory does not exist: {args.audio_dir}")

    candidates = [
        (path, dataset_label(path, args.dataset))
        for path in sorted(args.audio_dir.rglob("*.wav"))
    ]
    clips = [(path, label) for path, label in candidates if label]
    if args.limit > 0:
        clips = clips[:args.limit]
    elif args.sample_per_class > 0:
        sampler = random.Random(42)
        sampled_clips = []
        for label in LABELS:
            label_clips = [clip for clip in clips if clip[1] == label]
            if label_clips:
                sampled_clips.extend(sampler.sample(label_clips, min(args.sample_per_class, len(label_clips))))
        clips = sorted(sampled_clips, key=lambda clip: clip[0])
    if not clips:
        parser.error("no supported WAV clips found; check the extracted dataset directory")

    confusion = Counter()
    speechbrain_confusion = Counter()
    actual_counts = Counter()
    rejected = 0
    unscored = 0
    speechbrain_unscored = 0
    speechbrain_diagnostics = Counter()
    comparison_agreements = 0
    comparison_pairs = 0
    errors = []

    for index, (path, actual) in enumerate(clips, start=1):
        actual_counts[actual] += 1
        try:
            result = request_scores(args.service_url, as_16khz_wav(path), args.timeout)
            model_comparison = result.get("modelComparison", {})
            scores = model_comparison.get("existing", {}).get("scores", {})
            valid_scores = {
                str(label).lower(): float(score)
                for label, score in scores.items()
                if str(label).lower() in LABELS
            }
            existing_prediction = None
            if valid_scores:
                existing_prediction = max(valid_scores, key=valid_scores.get)
                confusion[(actual, existing_prediction)] += 1
                if not result.get("emotion"):
                    rejected += 1
            else:
                unscored += 1

            speechbrain = model_comparison.get("speechbrain", {})
            speechbrain_prediction = speechbrain.get("emotion") if isinstance(speechbrain, dict) else None
            if speechbrain_prediction in LABELS:
                speechbrain_confusion[(actual, speechbrain_prediction)] += 1
                if existing_prediction:
                    comparison_pairs += 1
                    comparison_agreements += existing_prediction == speechbrain_prediction
            else:
                speechbrain_unscored += 1
                if isinstance(speechbrain, dict):
                    if speechbrain.get("error"):
                        diagnostic = str(speechbrain["error"])
                        if speechbrain.get("missingAttribute"):
                            diagnostic += f":{speechbrain['missingAttribute']}"
                        if speechbrain.get("ownerType"):
                            diagnostic += f" on {speechbrain['ownerType']}"
                        if speechbrain.get("reason"):
                            diagnostic += f": {speechbrain['reason']}"
                        speechbrain_diagnostics[diagnostic] += 1
                    elif speechbrain.get("available") is False:
                        speechbrain_diagnostics["model unavailable"] += 1
                    elif speechbrain.get("label"):
                        speechbrain_diagnostics[f"unmapped label:{speechbrain['label']}"] += 1
                    else:
                        speechbrain_diagnostics["no prediction details"] += 1
        except (OSError, ValueError, wave.Error, urllib.error.URLError, json.JSONDecodeError) as error:
            errors.append({"file": path.name, "error": str(error)})
        if index % 25 == 0 or index == len(clips):
            print(f"Processed {index}/{len(clips)} clips", flush=True)

    existing_metrics = summarize_confusion(confusion, actual_counts, LABELS)
    speechbrain_metrics = summarize_confusion(speechbrain_confusion, actual_counts, LABELS)
    print(json.dumps({
        "dataset": args.dataset,
        "clips": len(clips),
        "scored": existing_metrics["scored"],
        "unscored": unscored,
        "rejectedByLiveConfidenceGate": rejected,
        "topClassAccuracy": existing_metrics["topClassAccuracy"],
        "perClass": existing_metrics["perClass"],
        "confusionMatrix": existing_metrics["confusionMatrix"],
        "speechbrainComparison": {
            **speechbrain_metrics,
            "unscored": speechbrain_unscored,
            "diagnostics": dict(speechbrain_diagnostics),
            "agreementWithExisting": {
                "pairs": comparison_pairs,
                "count": comparison_agreements,
                "rate": round(comparison_agreements / comparison_pairs, 3) if comparison_pairs else None,
            },
        },
        "requestErrors": errors[:20],
        "requestErrorCount": len(errors),
    }, indent=2))
    return 0 if existing_metrics["scored"] or speechbrain_metrics["scored"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
