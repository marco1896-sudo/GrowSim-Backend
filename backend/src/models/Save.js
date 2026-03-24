import mongoose from 'mongoose';

const saveSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    slot: {
      type: String,
      default: 'main',
      trim: true
    },
    state: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    }
  },
  { timestamps: true }
);

saveSchema.index({ userId: 1, slot: 1 }, { unique: true });

export const Save = mongoose.model('Save', saveSchema);
