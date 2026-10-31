"""Local Whisper transcription service for CaptionAI's Node.js backend."""

from __future__ import annotations

import os
import re
import tempfile
import math
import struct
import wave
import logging
from io import BytesIO
from contextlib import asynccontextmanager
from pathlib import Path
from threading import Lock

from fastapi import FastAPI, HTTPException, Request
from starlette.concurrency import run_in_threadpool

MODEL_NAME = os.getenv("WHISPER_MODEL", "base")
EMOTION_MODEL_NAME = os.getenv("SER_MODEL", "superb/wav2vec2-base-superb-er")
COMPARISON_MODEL_NAME = "speechbrain/emotion-recognition-wav2vec2-IEMOCAP"
COMPARISON_MODEL_REVISION = "39fb968b86d0ad16b048b8bdd6e7645533e200e6"
EMOTION_ENABLED = os.getenv("SER_ENABLED", "true").strip().lower() not in {"0", "false", "no"}
SER_MIN_CONFIDENCE = float(os.getenv("SER_MIN_CONFIDENCE", "0.70"))
SER_MIN_MARGIN = float(os.getenv("SER_MIN_MARGIN", "0.20"))
MAX_AUDIO_BYTES = 1024 * 1024
ALLOWED_LANGUAGES = {"en", "hi", "te"}
EMOTION_LANGUAGES = {"en"}
MODEL = None
MODEL_LOCK = Lock()
EMOTION_MODEL = None
EMOTION_MODEL_LOCK = Lock()
EMOTION_LOAD_ERROR = None
COMPARISON_MODEL = None
COMPARISON_MODEL_LOCK = Lock()
COMPARISON_MODEL_LOAD_ERROR = None
COMPARISON_MODEL_LOAD_REASON = None
SPEECH_VAD_READY = False
SPEECH_VAD_LOAD_ERROR = None
logger = logging.getLogger("captionai.ser")


def load_model() -> None:
    global MODEL
    if MODEL is None:
        from faster_whisper import WhisperModel

        MODEL = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")


def load_speech_vad() -> None:
    global SPEECH_VAD_READY, SPEECH_VAD_LOAD_ERROR
    try:
        from faster_whisper.vad import get_vad_model

        get_vad_model()
        SPEECH_VAD_READY = True
    except Exception as error:
        SPEECH_VAD_LOAD_ERROR = type(error).__name__
        logger.warning("Silero speech activity model could not be loaded (%s)", SPEECH_VAD_LOAD_ERROR)


def load_emotion_model() -> None:
    global EMOTION_MODEL, EMOTION_LOAD_ERROR
    if not EMOTION_ENABLED:
        return
    try:
        from transformers import pipeline

        EMOTION_MODEL = pipeline(
            "audio-classification",
            model=EMOTION_MODEL_NAME,
            device=-1,
        )
    except Exception as error:
        # SER is optional: keep speech-to-text available if its model cannot load.
        EMOTION_LOAD_ERROR = type(error).__name__
        logger.warning("Speech emotion model could not be loaded (%s)", EMOTION_LOAD_ERROR)


def load_comparison_model() -> None:
    global COMPARISON_MODEL, COMPARISON_MODEL_LOAD_ERROR, COMPARISON_MODEL_LOAD_REASON
    if not EMOTION_ENABLED:
        return
    model_cache = Path(__file__).parent / ".models" / "speechbrain-emotion-recognition"
    try:
        from speechbrain.inference.interfaces import foreign_class
        from speechbrain.utils.fetching import FetchConfig, LocalStrategy

        model_cache.mkdir(parents=True, exist_ok=True)
        # This checkpoint defines its own Wav2Vec2 inference interface. The
        # generic EncoderClassifier expects compute_features/mean_var_norm
        # modules that this model does not provide.
        COMPARISON_MODEL = foreign_class(
            source=COMPARISON_MODEL_NAME,
            pymodule_file="custom_interface.py",
            classname="CustomEncoderWav2vec2Classifier",
            fetch_config=FetchConfig(revision=COMPARISON_MODEL_REVISION),
            savedir=str(model_cache),
            local_strategy=LocalStrategy.COPY,
            run_opts={"device": "cpu"},
        )
    except Exception as error:
        # Comparison is optional and must not prevent the current SER or ASR from starting.
        COMPARISON_MODEL_LOAD_ERROR = type(error).__name__
        COMPARISON_MODEL_LOAD_REASON = str(error).replace(str(model_cache), "<model-cache>")[:300]
        logger.warning(
            "SpeechBrain comparison model could not be loaded (%s): %s",
            COMPARISON_MODEL_LOAD_ERROR,
            COMPARISON_MODEL_LOAD_REASON,
        )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await run_in_threadpool(load_model)
    await run_in_threadpool(load_speech_vad)
    await run_in_threadpool(load_emotion_model)
    await run_in_threadpool(load_comparison_model)
    yield


app = FastAPI(title="CaptionAI Local Speech Service", lifespan=lifespan)


@app.get("/health")
def health():
    return {
        "success": True,
        "model": MODEL_NAME,
        "ready": MODEL is not None,
        "speechVAD": {
            "ready": SPEECH_VAD_READY,
            "model": "Silero VAD",
            "error": SPEECH_VAD_LOAD_ERROR,
        },
        "emotion": {
            "enabled": EMOTION_ENABLED,
            "ready": EMOTION_MODEL is not None,
            "model": EMOTION_MODEL_NAME,
            "supportedLanguages": sorted(EMOTION_LANGUAGES),
        },
        "emotionComparison": {
            "enabled": EMOTION_ENABLED,
            "ready": COMPARISON_MODEL is not None,
            "model": COMPARISON_MODEL_NAME,
            "error": COMPARISON_MODEL_LOAD_ERROR,
            "reason": COMPARISON_MODEL_LOAD_REASON,
        },
    }


@app.post("/speech-presence")
async def speech_presence(request: Request):
    """Local-only speech gate used before cloud ASR to avoid noise captions."""
    audio = await request.body()
    if not audio:
        raise HTTPException(status_code=400, detail="Audio chunk is empty")
    if len(audio) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio chunk must be 1 MB or smaller")
    if not SPEECH_VAD_READY:
        raise HTTPException(status_code=503, detail="Speech activity model is unavailable")

    speech, duration_ms = await run_in_threadpool(contains_speech_with_vad, audio)
    return {"speech": speech, "speechDurationMs": duration_ms}


def file_suffix(content_type: str) -> str:
    normalized = content_type.lower()
    if "webm" in normalized:
        return ".webm"
    if "mp4" in normalized or "m4a" in normalized:
        return ".mp4"
    if "ogg" in normalized:
        return ".ogg"
    if "wav" in normalized or "wave" in normalized:
        return ".wav"
    raise HTTPException(status_code=415, detail="Unsupported audio format")


def transcribe_file(path: str, language: str):
    with MODEL_LOCK:
        segments, _info = MODEL.transcribe(
            path,
            language=language,
            beam_size=5,
            repetition_penalty=1.05,
            no_repeat_ngram_size=3,
            vad_filter=True,
            vad_parameters={
                "threshold": 0.5,
                "min_speech_duration_ms": 250,
                "speech_pad_ms": 300,
            },
            no_speech_threshold=0.5,
            log_prob_threshold=-0.7,
            compression_ratio_threshold=2.2,
            temperature=0.0,
            condition_on_previous_text=False,
        )
        return list(segments)


def limit_repeated_words(text: str) -> str:
    """Keep natural double words but stop decoder loops like 'bye bye bye…'."""
    return re.sub(
        r"\b([\w’'-]+)(?:[\s,]+\1){2,}\b",
        lambda match: f"{match.group(1)} {match.group(1)}",
        text,
        flags=re.IGNORECASE,
    )


def has_speech_energy(path: str) -> bool:
    """Require repeated, above-noise audio frames before invoking Whisper."""
    with wave.open(path, "rb") as audio_file:
        if audio_file.getsampwidth() != 2:
            raise HTTPException(status_code=400, detail="Audio must use 16-bit PCM WAV")
        sample_rate = audio_file.getframerate()
        frames = audio_file.readframes(audio_file.getnframes())

    sample_count = len(frames) // 2
    if sample_count == 0:
        return False

    frame_samples = max(1, round(sample_rate * 0.02))
    active_frames = 0
    current_run = 0
    longest_run = 0
    for offset in range(0, sample_count, frame_samples):
        end = min(offset + frame_samples, sample_count)
        samples = struct.iter_unpack("<h", frames[offset * 2 : end * 2])
        square_sum = sum(sample * sample for (sample,) in samples)
        frame_rms = math.sqrt(square_sum / (end - offset)) / 32768
        if frame_rms >= 0.003:
            active_frames += 1
            current_run += 1
            longest_run = max(longest_run, current_run)
        else:
            current_run = 0

    # Ignore isolated clicks and low-level room/microphone noise.
    return active_frames >= 8 and longest_run >= 4


def crop_to_speech(samples, sample_rate: int = 16000):
    """Join VAD-selected utterances and reject clips shorter than one second."""
    import numpy as np
    from faster_whisper.vad import VadOptions, get_speech_timestamps

    segments = get_speech_timestamps(
        samples,
        sampling_rate=sample_rate,
        vad_options=VadOptions(
            threshold=0.5,
            min_speech_duration_ms=250,
            min_silence_duration_ms=100,
            speech_pad_ms=100,
        ),
    )
    speech_parts = [
        samples[int(segment["start"]):int(segment["end"])]
        for segment in segments
        if int(segment["end"]) > int(segment["start"])
    ]
    if not speech_parts:
        return None
    speech_samples = np.concatenate(speech_parts)
    return speech_samples if speech_samples.size >= sample_rate else None


def contains_speech_with_vad(audio: bytes) -> tuple[bool, int]:
    """Use Silero VAD (bundled with faster-whisper) to distinguish speech from noise."""
    import numpy as np
    from faster_whisper.vad import VadOptions, get_speech_timestamps

    try:
        with wave.open(BytesIO(audio), "rb") as audio_file:
            if audio_file.getsampwidth() != 2:
                raise HTTPException(status_code=415, detail="Audio must use 16-bit PCM WAV")
            sample_rate = audio_file.getframerate()
            channels = audio_file.getnchannels()
            frames = audio_file.readframes(audio_file.getnframes())
    except (wave.Error, EOFError) as error:
        raise HTTPException(status_code=400, detail="Audio must be a valid PCM WAV file") from error

    if sample_rate < 8000 or sample_rate > 96000 or channels < 1:
        raise HTTPException(status_code=400, detail="Unsupported WAV sample rate or channel count")

    samples = np.frombuffer(frames, dtype="<i2").astype(np.float32) / 32768.0
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)
    if samples.size < sample_rate // 5:
        return False, 0

    target_rate = 16000
    if sample_rate != target_rate:
        target_count = max(1, round(samples.size * target_rate / sample_rate))
        old_positions = np.arange(samples.size, dtype=np.float32)
        new_positions = np.linspace(0, samples.size - 1, target_count, dtype=np.float32)
        samples = np.interp(new_positions, old_positions, samples).astype(np.float32)

    segments = get_speech_timestamps(
        samples,
        sampling_rate=target_rate,
        vad_options=VadOptions(
            threshold=0.65,
            min_speech_duration_ms=300,
            min_silence_duration_ms=100,
            speech_pad_ms=0,
        ),
    )
    speech_samples = sum(max(0, segment["end"] - segment["start"]) for segment in segments)
    speech_duration_ms = round(speech_samples * 1000 / target_rate)
    return speech_duration_ms >= 350, speech_duration_ms


def classify_emotion_file(path: str) -> dict[str, object] | None:
    import numpy as np

    with wave.open(path, "rb") as audio_file:
        if audio_file.getsampwidth() != 2:
            raise HTTPException(status_code=400, detail="Audio must use 16-bit PCM WAV")
        sample_rate = audio_file.getframerate()
        channels = audio_file.getnchannels()
        frames = audio_file.readframes(audio_file.getnframes())

    if sample_rate != 16000:
        raise HTTPException(status_code=400, detail="Audio must be sampled at 16 kHz")
    if channels < 1:
        return None

    samples = np.frombuffer(frames, dtype="<i2").astype(np.float32) / 32768.0
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)
    if samples.size == 0:
        return None

    # Keep only VAD-detected speech for SER. Silence and microphone noise can
    # dominate a short clip and make the emotion scores misleading.
    speech_samples = crop_to_speech(samples, sample_rate)
    if speech_samples is None:
        return {
            "emotion": None,
            "emotionConfidence": None,
            "supported": True,
            "uncertain": True,
            "modelComparison": {"existing": {"emotion": None, "score": 0.0, "margin": 0.0, "scores": {}}},
        }

    with EMOTION_MODEL_LOCK:
        predictions = EMOTION_MODEL(
            {"raw": speech_samples, "sampling_rate": sample_rate},
            top_k=None,
        )

    if not predictions:
        return None
    predictions = sorted(predictions, key=lambda item: float(item.get("score", 0)), reverse=True)
    prediction = predictions[0]
    score = float(prediction.get("score", 0))
    runner_up_score = float(predictions[1].get("score", 0)) if len(predictions) > 1 else 0.0
    label = str(prediction.get("label", "")).strip().lower()
    emotion = {
        "neu": "neutral",
        "neutral": "neutral",
        "hap": "happy",
        "happy": "happy",
        "happiness": "happy",
        "ang": "angry",
        "angry": "angry",
        "sad": "sad",
    }.get(label)
    label_map = {
        "neu": "neutral",
        "neutral": "neutral",
        "hap": "happy",
        "happy": "happy",
        "happiness": "happy",
        "ang": "angry",
        "angry": "angry",
        "sad": "sad",
    }
    all_scores: dict[str, float] = {}
    for item in predictions:
        raw_label = str(item.get("label", "")).strip().lower()
        score_value = float(item.get("score", 0))
        normalized_label = label_map.get(raw_label, raw_label or "unknown")
        all_scores[normalized_label] = round(max(all_scores.get(normalized_label, 0.0), score_value), 3)
    margin = score - runner_up_score
    comparison = {"emotion": emotion, "score": round(score, 3), "margin": round(margin, 3), "scores": all_scores}
    if score < SER_MIN_CONFIDENCE or margin < SER_MIN_MARGIN:
        return {
            "emotion": None,
            "emotionConfidence": None,
            "supported": True,
            "uncertain": True,
            "modelComparison": {"existing": comparison},
        }
    if emotion is None:
        return {
            "emotion": None,
            "emotionConfidence": None,
            "supported": True,
            "uncertain": True,
            "modelComparison": {"existing": comparison},
        }
    return {
        "emotion": emotion,
        "emotionConfidence": score,
        "supported": True,
        "uncertain": False,
        "modelComparison": {"existing": comparison},
    }


def classify_speechbrain_file(path: str) -> dict[str, str | float | None]:
    import numpy as np
    import torch

    with wave.open(path, "rb") as audio_file:
        if audio_file.getsampwidth() != 2 or audio_file.getframerate() != 16000:
            raise ValueError("SpeechBrain comparison requires 16 kHz, 16-bit PCM WAV")
        channels = audio_file.getnchannels()
        frames = audio_file.readframes(audio_file.getnframes())

    samples = np.frombuffer(frames, dtype="<i2").astype(np.float32) / 32768.0
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)
    samples = crop_to_speech(samples, 16000)
    if samples is None:
        return {"emotion": None, "score": 0.0, "label": ""}

    with COMPARISON_MODEL_LOCK:
        waveform = torch.from_numpy(samples).unsqueeze(0).to(COMPARISON_MODEL.device).float()
        _probabilities, score, _index, text_label = COMPARISON_MODEL.classify_batch(waveform)

    if hasattr(text_label, "tolist"):
        text_label = text_label.tolist()
    while isinstance(text_label, (list, tuple)):
        if not text_label:
            break
        text_label = text_label[0] if text_label else ""
    label = str(text_label).strip().lower()
    emotion = {
        "neu": "neutral",
        "neutral": "neutral",
        "hap": "happy",
        "happy": "happy",
        "ang": "angry",
        "angry": "angry",
        "sad": "sad",
    }.get(label)
    if hasattr(score, "detach"):
        score = score.detach().cpu().reshape(-1)[0].item()
    elif isinstance(score, (list, tuple)):
        score = score[0]
    return {"emotion": emotion, "score": float(score), "label": label}


@app.post("/transcribe")
async def transcribe(
    request: Request,
    language: str = "en",
    start_time: float = 0,
):
    if language not in ALLOWED_LANGUAGES:
        raise HTTPException(status_code=400, detail="Language must be one of: en, hi, te")
    if not math.isfinite(start_time) or start_time < 0:
        raise HTTPException(status_code=400, detail="start_time must be a non-negative finite number")

    audio = await request.body()
    if not audio:
        raise HTTPException(status_code=400, detail="Audio chunk is empty")
    if len(audio) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio chunk must be 1 MB or smaller")

    suffix = file_suffix(request.headers.get("content-type", ""))
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as audio_file:
            audio_file.write(audio)
            temp_path = audio_file.name

        # Skip near-silent chunks before decoding: Whisper can invent words from
        # mic noise even when VAD is enabled.
        if suffix == ".wav" and not has_speech_energy(temp_path):
            return {
                "text": "",
                "language": language,
                "startTime": start_time,
                "endTime": start_time,
                "source": "whisper",
            }

        segments = await run_in_threadpool(transcribe_file, temp_path, language)
        text = limit_repeated_words(" ".join(segment.text.strip() for segment in segments).strip())
        chunk_end = max((segment.end for segment in segments), default=0)
        return {
            "text": text,
            "language": language,
            "startTime": start_time,
            "endTime": start_time + max(0, chunk_end),
            "source": "whisper",
        }
    except HTTPException:
        raise
    except Exception as error:
        # Keep audio bytes and local filesystem paths out of API responses.
        raise HTTPException(status_code=500, detail="Could not transcribe this audio chunk") from error
    finally:
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)


@app.post("/emotion")
async def analyze_emotion(request: Request, language: str = "en"):
    if language not in ALLOWED_LANGUAGES:
        raise HTTPException(status_code=400, detail="Language must be one of: en, hi, te")
    if language not in EMOTION_LANGUAGES:
        return {"emotion": None, "emotionConfidence": None, "supported": False}
    if not EMOTION_ENABLED or EMOTION_MODEL is None:
        raise HTTPException(status_code=503, detail="Speech emotion model is unavailable")

    audio = await request.body()
    if not audio:
        raise HTTPException(status_code=400, detail="Audio chunk is empty")
    if len(audio) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio chunk must be 1 MB or smaller")
    if file_suffix(request.headers.get("content-type", "")) != ".wav":
        raise HTTPException(status_code=415, detail="Speech emotion analysis requires PCM WAV audio")

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as audio_file:
            audio_file.write(audio)
            temp_path = audio_file.name

        if not has_speech_energy(temp_path):
            return {"emotion": None, "emotionConfidence": None, "supported": True, "uncertain": True}

        result = await run_in_threadpool(classify_emotion_file, temp_path)
        if COMPARISON_MODEL is not None:
            try:
                comparison = await run_in_threadpool(classify_speechbrain_file, temp_path)
                model_comparison = result.setdefault("modelComparison", {})
                model_comparison["speechbrain"] = comparison
                existing_label = model_comparison.get("existing", {}).get("emotion")
                model_comparison["agreement"] = bool(existing_label and existing_label == comparison["emotion"])
            except Exception as error:
                reason = str(error).replace(temp_path, "<audio-file>")[:240]
                logger.warning(
                    "SpeechBrain comparison inference failed (%s): %s",
                    type(error).__name__,
                    reason,
                )
                diagnostic = {"error": type(error).__name__}
                if isinstance(error, ValueError) and reason:
                    diagnostic["reason"] = reason
                if isinstance(error, AttributeError):
                    missing_attribute = getattr(error, "name", None)
                    owner = getattr(error, "obj", None)
                    if missing_attribute:
                        diagnostic["missingAttribute"] = str(missing_attribute)
                    if owner is not None:
                        diagnostic["ownerType"] = type(owner).__name__
                result.setdefault("modelComparison", {})["speechbrain"] = diagnostic
        else:
            result.setdefault("modelComparison", {})["speechbrain"] = {
                "available": False,
                "error": COMPARISON_MODEL_LOAD_ERROR or "ModelUnavailable",
                "reason": COMPARISON_MODEL_LOAD_REASON,
            }
        return {**(result or {}), "supported": True}
    except HTTPException:
        raise
    except Exception as error:
        logger.warning("Speech emotion inference failed (%s)", type(error).__name__)
        raise HTTPException(status_code=500, detail="Could not analyze speech emotion") from error
    finally:
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)
