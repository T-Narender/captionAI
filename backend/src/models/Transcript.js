import mongoose from 'mongoose'

const transcriptSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    language: {
      type: String,
      enum: ['en', 'hi', 'te'],
      required: true,
    },
    provider: {
      type: String,
      enum: ['groq', 'local-whisper', 'local-whisper-fallback'],
      default: undefined,
    },
    startTime: {
      type: Number,
      min: 0,
      required: true,
    },
    endTime: {
      type: Number,
      min: 0,
      required: true,
    },
    emotion: {
      type: String,
      enum: ['neutral', 'happy', 'sad', 'angry'],
      default: undefined,
    },
    emotionConfidence: {
      type: Number,
      min: 0,
      max: 1,
      default: undefined,
    },
  },
  { timestamps: true },
)

transcriptSchema.index({ sessionId: 1, startTime: 1 })

export default mongoose.model('Transcript', transcriptSchema)
