import mongoose from 'mongoose';

const pushTypeStateSchema = new mongoose.Schema(
  {
    lastSentAt: {
      type: Date,
      default: null
    },
    lastSignature: {
      type: String,
      default: ''
    },
    lastCandidateAt: {
      type: Date,
      default: null
    }
  },
  { _id: false }
);

const gameplayPushStateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    lastEvaluatedAt: {
      type: Date,
      default: null
    },
    lastPushAt: {
      type: Date,
      default: null
    },
    quietHours: {
      enabled: { type: Boolean, default: true },
      startHour: { type: Number, default: 22, min: 0, max: 23 },
      endHour: { type: Number, default: 7, min: 0, max: 23 },
      timezone: { type: String, default: 'UTC', trim: true, maxlength: 80 }
    },
    typeState: {
      plant_needs_water: { type: pushTypeStateSchema, default: () => ({}) },
      event_occurred: { type: pushTypeStateSchema, default: () => ({}) },
      harvest_ready: { type: pushTypeStateSchema, default: () => ({}) },
      daily_reward_available: { type: pushTypeStateSchema, default: () => ({}) }
    }
  },
  { timestamps: true }
);

export const GameplayPushState = mongoose.model('GameplayPushState', gameplayPushStateSchema);
