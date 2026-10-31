"""Fine-tune CaptionAI's four-class wav2vec2 SER model on local RAVDESS + CREMA-D.

All recordings are kept local. Actors are split before training so an actor's
recordings cannot appear in more than one of train, validation, and test.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import random
import wave
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

import numpy as np

SAMPLE_RATE = 16_000
# Keep the checkpoint's original classifier-row order so its pretrained head
# retains the correct emotion-to-logit mapping during fine-tuning.
LABELS = ("neutral", "happy", "angry", "sad")
LABEL_TO_ID = {label: index for index, label in enumerate(LABELS)}
ID_TO_LABEL = {index: label for label, index in LABEL_TO_ID.items()}
MODEL_LABELS = {
    "ang": "angry", "angry": "angry",
    "hap": "happy", "happy": "happy",
    "neu": "neutral", "neutral": "neutral",
    "sad": "sad",
}
RAVDESS_LABELS = {"01": "neutral", "03": "happy", "04": "sad", "05": "angry"}
CREMA_LABELS = {"ANG": "angry", "HAP": "happy", "NEU": "neutral", "SAD": "sad"}


@dataclass(frozen=True)
class Example:
    path: Path
    cache_path: Path
    corpus: str
    speaker: str
    label: str


def identify(path: Path, corpus: str) -> tuple[str, str] | None:
    parts = path.stem.split("-") if corpus == "ravdess" else path.stem.split("_")
    if corpus == "ravdess":
        if len(parts) < 7 or parts[0] != "03" or parts[1] != "01":
            return None
        label = RAVDESS_LABELS.get(parts[2])
        speaker = parts[-1]
    else:
        if len(parts) < 4:
            return None
        label = CREMA_LABELS.get(parts[2].upper())
        speaker = parts[0]
    if label not in LABEL_TO_ID:
        return None
    return f"{corpus}:{speaker}", label


def read_mono_16khz(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as audio_file:
        if audio_file.getsampwidth() != 2 or audio_file.getcomptype() != "NONE":
            raise ValueError(f"Expected uncompressed 16-bit PCM WAV: {path.name}")
        source_rate = audio_file.getframerate()
        channels = audio_file.getnchannels()
        if not 8000 <= source_rate <= 96000 or channels < 1:
            raise ValueError(f"Unsupported WAV format: {path.name}")
        pcm = audio_file.readframes(audio_file.getnframes())

    samples = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)
    if source_rate != SAMPLE_RATE and samples.size:
        target_count = max(1, round(samples.size * SAMPLE_RATE / source_rate))
        samples = np.interp(
            np.linspace(0, samples.size - 1, target_count, dtype=np.float32),
            np.arange(samples.size, dtype=np.float32),
            samples,
        ).astype(np.float32)
    return samples


def cached_speech(path: Path, cache_dir: Path, crop_to_speech) -> Path | None:
    stat = path.stat()
    key = hashlib.sha256(
        f"{path.resolve()}:{stat.st_size}:{stat.st_mtime_ns}:vad-v1".encode("utf-8")
    ).hexdigest()
    cache_path = cache_dir / f"{key}.npy"
    if cache_path.exists():
        return cache_path if np.load(cache_path, mmap_mode="r").size >= SAMPLE_RATE else None

    samples = read_mono_16khz(path)
    speech = crop_to_speech(samples, SAMPLE_RATE)
    if speech is None:
        return None
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    np.save(cache_path, np.asarray(speech, dtype=np.float32), allow_pickle=False)
    return cache_path


def split_speakers(examples: list[Example], seed: int) -> dict[str, str]:
    by_corpus: dict[str, set[str]] = defaultdict(set)
    for example in examples:
        by_corpus[example.corpus].add(example.speaker)

    rng = random.Random(seed)
    assignments: dict[str, str] = {}
    for corpus, speakers in sorted(by_corpus.items()):
        ordered = sorted(speakers)
        rng.shuffle(ordered)
        test_count = max(1, round(len(ordered) * 0.15))
        validation_count = max(1, round(len(ordered) * 0.15))
        if test_count + validation_count >= len(ordered):
            raise ValueError(f"Not enough speakers in {corpus} for independent splits")
        for speaker in ordered[:test_count]:
            assignments[speaker] = "test"
        for speaker in ordered[test_count:test_count + validation_count]:
            assignments[speaker] = "validation"
        for speaker in ordered[test_count + validation_count:]:
            assignments[speaker] = "train"
    return assignments


class CachedAudioDataset:
    def __init__(self, examples: list[Example], feature_extractor):
        self.examples = examples
        self.feature_extractor = feature_extractor

    def __len__(self) -> int:
        return len(self.examples)

    def __getitem__(self, index: int) -> dict[str, object]:
        example = self.examples[index]
        samples = np.load(example.cache_path, mmap_mode="r")
        features = self.feature_extractor(
            np.asarray(samples, dtype=np.float32),
            sampling_rate=SAMPLE_RATE,
            return_attention_mask=True,
        )
        return {
            "input_values": features.input_values[0],
            "attention_mask": features.attention_mask[0],
            "labels": LABEL_TO_ID[example.label],
        }


def metrics_for_predictions(prediction) -> dict[str, float]:
    logits = prediction.predictions[0] if isinstance(prediction.predictions, tuple) else prediction.predictions
    predicted = np.argmax(logits, axis=-1)
    actual = prediction.label_ids
    matrix = np.zeros((len(LABELS), len(LABELS)), dtype=np.int64)
    for truth, guess in zip(actual, predicted):
        matrix[int(truth), int(guess)] += 1

    recalls = []
    f1_scores = []
    for index in range(len(LABELS)):
        true_positive = int(matrix[index, index])
        support = int(matrix[index, :].sum())
        predicted_count = int(matrix[:, index].sum())
        recall = true_positive / support if support else 0.0
        precision = true_positive / predicted_count if predicted_count else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        recalls.append(recall)
        f1_scores.append(f1)

    return {
        "accuracy": float(np.mean(predicted == actual)),
        "macro_recall": float(np.mean(recalls)),
        "macro_f1": float(np.mean(f1_scores)),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ravdess-dir", type=Path, required=True, help="RAVDESS extracted WAV root")
    parser.add_argument("--crema-d-dir", type=Path, required=True, help="CREMA-D AudioWAV directory")
    parser.add_argument("--model", default="superb/wav2vec2-base-superb-er", help="Existing four-class SER checkpoint")
    parser.add_argument("--output-dir", type=Path, default=Path(".models/ser-ravdess-cremad"))
    parser.add_argument("--epochs", type=float, default=5)
    parser.add_argument("--batch-size", type=int, default=2)
    parser.add_argument("--learning-rate", type=float, default=1e-5)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--unfreeze-feature-encoder", action="store_true", help="Also update the low-level convolutional encoder")
    args = parser.parse_args()

    for dataset_dir in (args.ravdess_dir, args.crema_d_dir):
        if not dataset_dir.is_dir():
            parser.error(f"dataset directory does not exist: {dataset_dir}")
    if args.epochs <= 0 or args.batch_size < 1 or args.learning_rate <= 0:
        parser.error("epochs, batch-size, and learning-rate must be positive")

    from main import crop_to_speech

    args.output_dir = args.output_dir.resolve()
    cache_dir = args.output_dir.parent / f"{args.output_dir.name}-audio-cache"
    examples: list[Example] = []
    rejected_by_vad = 0
    candidates = (
        [(path, "ravdess") for path in sorted(args.ravdess_dir.rglob("*.wav"))]
        + [(path, "crema-d") for path in sorted(args.crema_d_dir.rglob("*.wav"))]
    )
    selected = [(path, corpus, identify(path, corpus)) for path, corpus in candidates]
    selected = [(path, corpus, identity) for path, corpus, identity in selected if identity]
    if not selected:
        parser.error("no supported four-class RAVDESS/CREMA-D WAV files found")

    for index, (path, corpus, identity) in enumerate(selected, start=1):
        speaker, label = identity
        cache_path = cached_speech(path, cache_dir, crop_to_speech)
        if cache_path is None:
            rejected_by_vad += 1
            continue
        examples.append(Example(path, cache_path, corpus, speaker, label))
        if index % 250 == 0 or index == len(selected):
            print(f"Prepared {index}/{len(selected)} clips", flush=True)

    if not examples:
        parser.error("VAD rejected all selected recordings")
    splits = split_speakers(examples, args.seed)
    split_examples = {
        name: [example for example in examples if splits[example.speaker] == name]
        for name in ("train", "validation", "test")
    }
    for split_name, split in split_examples.items():
        counts = Counter(example.label for example in split)
        if set(counts) != set(LABELS):
            raise ValueError(f"{split_name} split is missing a class: {dict(counts)}")
        print(f"{split_name}: {len(split)} clips {dict(sorted(counts.items()))}")
    print(f"Skipped by the same speech VAD used by the app: {rejected_by_vad}")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    with (args.output_dir / "split_manifest.csv").open("w", newline="", encoding="utf-8") as manifest_file:
        writer = csv.writer(manifest_file)
        writer.writerow(("path", "corpus", "speaker", "label", "split"))
        for example in sorted(examples, key=lambda item: str(item.path)):
            writer.writerow((str(example.path), example.corpus, example.speaker, example.label, splits[example.speaker]))

    import torch
    from transformers import (
        AutoFeatureExtractor,
        EarlyStoppingCallback,
        Trainer,
        TrainingArguments,
        Wav2Vec2ForSequenceClassification,
        DataCollatorWithPadding,
    )
    from torch.nn import functional as F

    feature_extractor = AutoFeatureExtractor.from_pretrained(args.model)
    model = Wav2Vec2ForSequenceClassification.from_pretrained(args.model)
    checkpoint_labels = {
        int(index): MODEL_LABELS.get(str(label).strip().lower())
        for index, label in model.config.id2label.items()
    }
    if set(checkpoint_labels.values()) != set(LABELS) or len(checkpoint_labels) != len(LABELS):
        raise ValueError(f"Checkpoint labels do not match the four expected classes: {checkpoint_labels}")
    label_to_id = {label: index for index, label in checkpoint_labels.items()}
    model.config.id2label = {index: label for index, label in checkpoint_labels.items()}
    model.config.label2id = label_to_id
    model.config.problem_type = "single_label_classification"
    if not args.unfreeze_feature_encoder:
        model.freeze_feature_encoder()

    train_counts = Counter(example.label for example in split_examples["train"])
    class_weights = torch.tensor(
        [len(split_examples["train"]) / (len(LABELS) * train_counts[label]) for label in LABELS],
        dtype=torch.float32,
    )

    class WeightedTrainer(Trainer):
        def compute_loss(self, model, inputs, return_outputs=False, num_items_in_batch=None):
            labels = inputs.pop("labels")
            outputs = model(**inputs)
            weights = class_weights.to(outputs.logits.device)
            loss = F.cross_entropy(outputs.logits, labels, weight=weights)
            return (loss, outputs) if return_outputs else loss

    training_args = TrainingArguments(
        output_dir=str(args.output_dir / "checkpoints"),
        num_train_epochs=args.epochs,
        learning_rate=args.learning_rate,
        weight_decay=0.01,
        warmup_ratio=0.1,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        gradient_accumulation_steps=2,
        eval_strategy="epoch",
        save_strategy="epoch",
        logging_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="macro_f1",
        greater_is_better=True,
        save_total_limit=2,
        save_only_model=True,
        report_to="none",
        seed=args.seed,
        data_seed=args.seed,
        dataloader_num_workers=0,
        gradient_checkpointing=True,
    )
    trainer = WeightedTrainer(
        model=model,
        args=training_args,
        data_collator=DataCollatorWithPadding(feature_extractor, padding=True, return_tensors="pt"),
        train_dataset=CachedAudioDataset(split_examples["train"], feature_extractor),
        eval_dataset=CachedAudioDataset(split_examples["validation"], feature_extractor),
        compute_metrics=metrics_for_predictions,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=2)],
    )

    trainer.train()
    test_metrics = trainer.evaluate(
        eval_dataset=CachedAudioDataset(split_examples["test"], feature_extractor),
        metric_key_prefix="test",
    )
    trainer.save_model(str(args.output_dir))
    feature_extractor.save_pretrained(str(args.output_dir))
    report = {
        "baseModel": args.model,
        "labels": list(LABELS),
        "seed": args.seed,
        "speakerIndependentSplit": True,
        "clips": {name: len(items) for name, items in split_examples.items()},
        "testMetrics": test_metrics,
        "vadRejected": rejected_by_vad,
        "featureEncoderFrozen": not args.unfreeze_feature_encoder,
    }
    (args.output_dir / "training_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"Fine-tuned model saved to: {args.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
