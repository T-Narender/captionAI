# CaptionAI Local Whisper Service

This local service transcribes PCM WAV chunks with `faster-whisper` and analyzes vocal emotion with a Hugging Face audio-classification model. WAV chunks must contain repeated audio frames above the noise floor before transcription; Silero VAD and decoder thresholds reduce captions from silence/noise, and repeated-token guards prevent runaway word loops. The `/speech-presence` endpoint runs the bundled Silero VAD without transcription; the Node backend calls it before Groq so background noise is less likely to become a caption. The existing SER model remains `superb/wav2vec2-base-superb-er`; its labels, thresholds, and app output are unchanged. Emotion inference crops the rolling audio window to VAD-detected speech (and skips windows with less than one second of speech). Its `modelComparison.existing.scores` field returns the normalized class score distribution, which the Node backend writes to `SER model comparison` logs. A shadow comparison runs `speechbrain/emotion-recognition-wav2vec2-IEMOCAP` with SpeechBrain's `classify_batch` inference pipeline on the same English audio window. Comparison inference does not change the emotion shown in the app. Both checkpoints use IEMOCAP, so this tests implementation/model differences on your microphone input; it does not establish performance on spontaneous speech. Audio is held in temporary files for decoding and removed after each request; it is not stored as a session recording. Whisper transcripts and accepted emotion scores are saved to MongoDB.

The requirements pin PyAV below version 19 because PyAV 19 removed the `metadata_errors` option that the current `faster-whisper` decoder still passes to `av.open()`.

## Setup (PowerShell)

From the repository root:

```powershell
cd ai-service
py -m venv .venv
.\.venv\Scripts\Activate.ps1
.\.venv\Scripts\python.exe -m pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Use this project's `.venv` Python path even if another project's environment is active in the terminal; this keeps CaptionAI's dependencies separate.

For the first run, allow time for the model downloads, including the additional 378 MB SpeechBrain checkpoint. `WHISPER_MODEL` can be set to a supported `faster-whisper` model size such as `tiny`, `base`, or `small`; `base` is the default. `SER_MODEL` selects the existing Hugging Face emotion model and defaults to `superb/wav2vec2-base-superb-er`. Set `SER_ENABLED=false` to run transcription without loading either emotion model. The browser sends three-second chunks to provide phrase context while limiting caption delay.

Then, in `backend/.env`, set:

```env
AI_SERVICE_MODE=whisper
AI_SERVICE_URL=http://localhost:8000
```

Restart the Node.js backend after changing its environment. Keep `AI_SERVICE_MODE=mock` to use mock captions without installing Python dependencies or downloading a model. Never put the MongoDB URI or credentials in this service's configuration.

## API

- `GET /health` reports ASR, existing SER, and shadow comparison model readiness.
- `POST /speech-presence` accepts a PCM WAV body and returns a local Silero VAD speech/no-speech decision for Groq pre-filtering.
- `POST /transcribe?language=en&start_time=0` accepts one `audio/wav` request body and returns `{ text, language, startTime, endTime, source }`.
- `POST /emotion?language=en` accepts the same 16 kHz PCM WAV body and returns the existing prediction plus `modelComparison` diagnostics for both checkpoints, including all existing-model class scores.

### Evaluate SER on labeled audio

Extract RAVDESS or CREMA-D locally, start the AI service, and run the evaluator from this directory. It does not download or upload datasets anywhere; clips are posted only to the configured local emotion endpoint. It reports top-class accuracy and per-class recall for both the existing model and the SpeechBrain comparison on the same clips, confusion matrices, model agreement, and how often the live confidence gate rejected an otherwise scored existing-model clip.

```powershell
.\.venv\Scripts\python.exe evaluate_ser.py ravdess ..\datasets\RAVDESS
.\.venv\Scripts\python.exe evaluate_ser.py crema-d ..\datasets\CREMA-D --limit 25
```

The quick `--limit` run checks that the local service and dataset path work. Use the full dataset for a meaningful comparison. The RAVDESS parser keeps audio-only speech recordings and the four classes supported by the current model (`angry`, `happy`, `neutral`, `sad`); CREMA-D uses the same four classes. The benchmark is acted speech and does not guarantee performance on spontaneous microphone or TTS audio.

### Fine-tune the existing SER checkpoint

`train_ser.py` fine-tunes `superb/wav2vec2-base-superb-er` on the four shared RAVDESS/CREMA-D classes. It applies the same Silero VAD crop used by `/emotion`, caches those crops under `.models/`, and splits speakers separately within each corpus into train, validation, and test sets. It saves a split manifest, the best validation checkpoint, and held-out test metrics. Data and checkpoints stay local; no MongoDB or backend environment variables are used.

```powershell
cd ai-service
.\.venv\Scripts\python.exe .\train_ser.py `
  --ravdess-dir "C:\Datasets\RAVDESS\Audio_Speech_Actors_01-24_16k" `
  --crema-d-dir "C:\Datasets\CREMA-D\AudioWAV" `
  --output-dir ".models\ser-ravdess-cremad" `
  --epochs 5
```

Stop the AI service before training to free memory. Wav2vec2 fine-tuning is compute intensive; the provided Python requirements install CPU-only PyTorch, so training may take a long time without a CUDA-enabled environment. The convolutional feature encoder is frozen by default to reduce overfitting; pass `--unfreeze-feature-encoder` only when you have enough compute and want to update it too. Checkpoints save model weights only to limit disk use, so an interrupted run cannot resume optimizer state. Training does not change the app's current model. To compare the saved checkpoint, stop the AI service, set `SER_MODEL` to its local path in that service's PowerShell session, restart it, and run `evaluate_ser.py` on held-out RAVDESS and CREMA-D audio. Keep the current checkpoint until those results support a change.

ASR supports English (`en`), Hindi (`hi`), and Telugu (`te`). In Groq mode, Hindi/Telugu use the accuracy-oriented `whisper-large-v3` model by default and collect ten-second chunks for more phrase context; English keeps the existing three-second cadence. This trades some caption delay for better multilingual context. Groq documents the accuracy-oriented model as optimized for 30-second segments with a 10-second minimum. You can override the model with `GROQ_MULTILINGUAL_WHISPER_MODEL`. Both SER checkpoints support English and were trained on IEMOCAP; the app therefore skips emotion inference for Hindi/Telugu rather than show unsupported predictions. Emotion analysis gets a rolling window of up to six seconds to provide more utterance context. Emotion inference runs after the caption is emitted, so it does not add model inference time to the live caption response. The SpeechBrain model only runs as a comparison and does not update the live panel or saved transcript. Use the backend console's `SER model comparison` entries to inspect side-by-side predictions and all class scores. The current confidence and margin filters remain active while these scores are gathered. Neither checkpoint guarantees correct labels for spontaneous microphone speech.
