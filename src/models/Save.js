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
      trim: true,
      minlength: 1,
      maxlength: 50,
      match: /^[a-zA-Z0-9_-]+$/
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
