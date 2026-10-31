import mongoose from 'mongoose'

const preferencesSchema = new mongoose.Schema({
  language: { type: String, enum: ['English', 'Hindi', 'Telugu'], default: 'English' },
  fontSize: { type: String, enum: ['small', 'regular', 'large'], default: 'regular' },
  density: { type: String, enum: ['comfortable', 'compact'], default: 'comfortable' },
  theme: { type: String, enum: ['light', 'dark', 'system'], default: 'light' },
  highContrast: { type: Boolean, default: false },
  reducedMotion: { type: Boolean, default: false },
}, { _id: false })

const userSchema = new mongoose.Schema(
  {
    displayName: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, unique: true },
    passwordHash: { type: String, required: true, select: false },
    preferences: { type: preferencesSchema, default: () => ({}) },
  },
  { timestamps: true },
)

export default mongoose.model('User', userSchema)
