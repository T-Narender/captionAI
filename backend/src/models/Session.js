import mongoose from 'mongoose'

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    language: {
      type: String,
      enum: ['en', 'hi', 'te'],
      required: true,
      default: 'en',
    },
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active',
      required: true,
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
      default: null,
    },
    duration: {
      type: Number,
      min: 0,
      default: 0,
    },
    pausedAt: {
      type: Date,
      default: null,
    },
    pausedDurationMs: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { timestamps: true },
)

sessionSchema.index({ userId: 1, startTime: -1 })

export default mongoose.model('Session', sessionSchema)
