# CaptionAI Backend

CaptionAI backend for account authentication, user-owned session history, MongoDB models, and Socket.IO events. Audio-to-caption behavior depends on `AI_SERVICE_MODE`.

## Requirements

- Node.js 20.19 or newer (required by the selected Mongoose release)
- MongoDB running locally or a MongoDB connection string

## Install and run

From the repository root in PowerShell:

```powershell
cd backend
npm install
npm run dev
```

The explicit package installation commands are:

```powershell
npm install express mongoose socket.io cors dotenv helmet morgan
npm install --save-dev nodemon socket.io-client
```

`backend/.env` is a local development file and is ignored by Git. To recreate it, copy the example:

```powershell
Copy-Item .env.example .env
```

The example defaults to local MongoDB at `127.0.0.1:27017`. Start MongoDB before starting the backend. The server waits for a successful MongoDB connection before it listens on port 5000. If the URI has no database path, the backend selects `captionai`; if credentialed access has no `authSource`, it uses MongoDB's standard `admin` authentication database. Explicit URI values take precedence.

Set `JWT_SECRET` in your local `backend/.env` before starting the server. You can choose your own private, hard-to-guess secret; it must be at least 32 bytes (32 or more plain ASCII characters). Keep it private and do not paste it into chat or commit it. It signs the HttpOnly authentication cookie. The `.env.example` value is blank and is not suitable for running the application. Changing the secret invalidates existing sign-in cookies, so users will need to sign in again.

For MongoDB Atlas, the URI must contain a real **Database Access** user and its password. The Atlas website login is not a database credential. Replace any generated username/password placeholders locally in `backend/.env`, and URL-encode reserved characters in each credential. Do not paste the URI into chat or logs. Startup errors are redacted and give a safe credential/connection hint.

Environment variables:

| Variable | Purpose | Example |
| --- | --- | --- |
| `PORT` | HTTP and Socket.IO port | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/captionai` |
| `CLIENT_URL` | Allowed frontend origin(s), comma separated | `http://localhost:5173` |
| `JWT_SECRET` | Private random key used to sign account session cookies | Keep only in local `.env` |
| `AI_SERVICE_URL` | Local Python speech service endpoint | `http://localhost:8000` |
| `AI_SERVICE_MODE` | Audio processing mode: `mock`, `whisper` (local), or `groq` (Groq primary with local Whisper fallback) | `mock` |
| `GROQ_API_KEY` | Secret key for Groq speech-to-text; keep it only in your local `.env` | Not set |
| `GROQ_WHISPER_MODEL` | Groq transcription model | `whisper-large-v3-turbo` |
| `GROQ_MULTILINGUAL_WHISPER_MODEL` | Accuracy-oriented Groq model for Hindi and Telugu | `whisper-large-v3` |
| `NODE_ENV` | Error response mode | `development` |

## REST API

All responses use JSON. The API is mounted under `/api`.

### Authentication and account profile

Create an account with `POST /api/auth/register` and `{ "displayName", "email", "password" }`, or sign in with `POST /api/auth/login` and `{ "email", "password" }`. Passwords must be 8–128 characters. Successful sign-in/register sets a seven-day, HttpOnly, SameSite=Lax cookie; clients should use credentialed requests and never store the token in local storage. `POST /api/auth/logout` clears the cookie. `GET /api/auth/me` returns the current account and its preferences. `PATCH /api/auth/me` updates `{ "displayName" }` or a full validated `{ "preferences" }` object. Caption language, font size, density, theme, contrast, and reduced-motion preferences are stored per account. Microphone device selection stays locally scoped to the account in the current browser because device IDs differ between computers.

All `/api/sessions` routes and Socket.IO connections require this cookie. Session creation assigns ownership from the authenticated account. Listing, dashboard transcript summaries, session details, rename/end operations, and live socket events are scoped to that owner. Existing database sessions created before this ownership field was introduced have no owner and will not appear in an account's history; they are not automatically assigned to the first account.

### Health

```http
GET /api/health
```

```json
{ "success": true, "message": "CaptionAI backend is running" }
```

### Create a session

```http
POST /api/sessions
Content-Type: application/json
```

```json
{ "title": "Classroom Session", "language": "en" }
```

`language` accepts `en`, `hi`, or `te` and defaults to `en`. Status and timestamps are assigned by the server; client-provided values are ignored.

```json
{
  "success": true,
  "session": {
    "_id": "<mongo-id>",
    "title": "Classroom Session",
    "language": "en",
    "status": "active",
    "startTime": "<server timestamp>",
    "endTime": null,
    "duration": 0,
    "createdAt": "<server timestamp>",
    "updatedAt": "<server timestamp>"
  }
}
```

### List sessions

```http
GET /api/sessions
```

Returns `{ "success": true, "count": 1, "sessions": [...] }`, newest first.

Optional `search`, `language`, and `date` query parameters filter session titles, transcript text, emotion labels, language, and UTC session date. Search is case-insensitive and limited to 100 characters. Add `page` and `limit` for pagination (positive integers; limit is at most 50); paginated responses include `pagination: { page, limit, total, pages }`. Without pagination parameters, the endpoint returns all matching sessions for dashboard summaries.

### Recent transcript activity

```http
GET /api/sessions/recent-transcripts
```

Returns up to five most recently saved transcript segments, including the session title and ID for dashboard links. This only includes transcripts produced in Whisper mode; mock captions remain transient.

### Get a session and its transcripts

```http
GET /api/sessions/<session-id>
```

Returns `{ "success": true, "session": {...}, "transcripts": [...] }`. Saved transcript segments include a `provider` field (`groq`, `local-whisper`, or `local-whisper-fallback`) so the UI can show which ASR handled each caption. Older records may not have this field. The transcript array is empty for mock Socket.IO captions because mock results are intentionally not persisted.

```json
{
  "success": true,
  "session": { "_id": "<mongo-id>", "title": "Classroom Session", "language": "en", "status": "active" },
  "transcripts": []
}
```

### Rename a session

```http
PATCH /api/sessions/<session-id>
Content-Type: application/json
```

```json
{ "title": "Project planning meeting" }
```

Titles are trimmed and must contain 1–120 characters. The updated session is returned in the response.

### End a session

```http
POST /api/sessions/<session-id>/end
```

Marks an active session completed, sets a server-side `endTime`, and calculates `duration` in seconds, excluding paused time. Ending an already completed session returns HTTP 409.

```json
{
  "success": true,
  "session": { "_id": "<mongo-id>", "status": "completed", "duration": 24, "endTime": "<server timestamp>" }
}
```

Errors use `{ "success": false, "message": "..." }`. Invalid IDs/bodies return HTTP 400, missing sessions return 404, and attempts to end a completed session return 409.

### Delete a completed session

```http
DELETE /api/sessions/<session-id>
```

Deletes the signed-in user's completed session and its saved transcript rows. Active sessions cannot be deleted; stop them first. Attempts to delete another account's session return 404.

Session endpoints require the authentication cookie. Sign in through the frontend first; the frontend API client automatically sends the HttpOnly cookie. Unauthenticated requests receive HTTP 401.

Session deletion removes its saved transcript rows before deleting the owned session record. MongoDB standalone deployments do not support transactions, so deletion uses this ordered cleanup.

## Socket.IO events

The socket namespace is the default `/`. Connect from the configured frontend origin while signed in so the browser sends the authentication cookie, then send:

### `start_session`

```js
socket.emit('start_session', { sessionId }, (ack) => console.log(ack))
```

Validates the MongoDB ID and session, then associates that socket with the active session. It does not create another session. The acknowledgement is `{ success: true, sessionId, status: 'active' }`.

### `audio_chunk`

Send a binary `Buffer`/`ArrayBuffer` or a base64 string in `audioChunk` (or `chunk`):

```js
socket.emit('audio_chunk', { sessionId, audioChunk }, (ack) => console.log(ack))
```

Chunks must be 1 MB or smaller and the socket must have started that active session. The server logs socket ID, session ID, and byte count, then calls `processAudioChunk()`. The temporary mock emits `caption` and `emotion`; an acknowledgement also includes the caption. A future partial result can use `caption_update`. The `emotion` event includes the session ID, label, confidence, and segment times. No raw audio or mock transcript is stored.

### `pause_session` and `resume_session`

```js
socket.emit('pause_session', { sessionId }, (ack) => console.log(ack))
socket.emit('resume_session', { sessionId }, (ack) => console.log(ack))
```

Both events require a session started on that socket. Pause intervals are tracked in MongoDB and subtracted from the completed session duration, including when a session is stopped while paused.

### `end_session`

```js
socket.emit('end_session', { sessionId }, (ack) => console.log(ack))
```

Completes the session and emits `session_complete` with `{ sessionId, status: 'completed', duration }`. Invalid payloads and session errors are acknowledged when possible and emitted as `error` with `{ success: false, message }`.

### Socket smoke client

Sign in first and create an active session through `POST /api/sessions`, then use its returned ID. The socket smoke client also requires the signed-in browser cookie in `AUTH_COOKIE`:

```powershell
npm run socket:smoke -- <session-id>
```

Set the cookie for that PowerShell window without pasting it into source files: `$env:AUTH_COOKIE = 'captionai_session=<cookie-value>'`. Treat it as a password and clear it after use with `Remove-Item Env:AUTH_COOKIE`.

The smoke client connects, starts the session, sends sample bytes, checks the mock caption, ends the session, and disconnects. The sample socket run completes the session.

## Smoke checks

With MongoDB and the backend running in one terminal, run this in another terminal from `backend/`:

```powershell
npm run api:smoke
```

It checks health, create/list/detail/end, invalid IDs, and repeated completion. It creates one completed sample session in MongoDB.

## Folder map

- `src/config/db.js` connects Mongoose before the HTTP server starts.
- `src/models/Session.js` and `src/models/Transcript.js` define persisted data shapes.
- `src/controllers/sessionController.js` implements session REST operations.
- `src/routes/sessionRoutes.js` maps the REST endpoints.
- `src/services/sessionService.js` shares session start/end behavior between HTTP and sockets.
- `src/services/aiService.js` defines the future AI boundary and temporary mock result.
- `src/sockets/socketHandler.js` validates the live event flow and emits caption results.
- `src/middleware/` standardizes 404 and error responses.
- `src/utils/` contains the application error type and small logger.
- `src/app.js` configures Express, security middleware, CORS, health, and routes.
- `src/server.js` loads environment variables, connects MongoDB, and starts HTTP plus Socket.IO.

## Frontend and local transcription integration

The React frontend uses `VITE_API_URL` (defaults to `http://localhost:5000`) for session REST calls and connects to the same origin with `socket.io-client`. After the user starts a session, the Live Session screen captures mono microphone audio, converts it to short 16 kHz PCM WAV chunks, and sends those chunks over Socket.IO. In `groq` mode, the backend first applies a PCM energy prefilter and asks local Silero VAD to distinguish speech from background noise, then sends speech chunks to Groq and falls back to local Whisper if Groq is unavailable, rejects the request, or returns an invalid response. The local AI service must report both Whisper and speech VAD ready before the backend starts in this mode. Set `GROQ_API_KEY` in your local `backend/.env` and `AI_SERVICE_MODE=groq`; never commit or share the key. For fallback and VAD, follow `../ai-service/README.md` and keep the Python service running at `AI_SERVICE_URL`. The Groq request has a 10-second timeout before fallback. The raw audio is processed in memory and is not stored as a recording. Real Whisper transcript segments from either provider are saved to MongoDB and appear in Session Details. English emotion results are still analyzed asynchronously by the local Python service; Hindi and Telugu SER remain unsupported by the selected checkpoint. Mock captions remain transient.
