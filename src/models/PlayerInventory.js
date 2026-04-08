import mongoose from 'mongoose';

const playerInventorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    badges: {
      type: [String],
      default: []
    },
    titles: {
      type: [String],
      default: []
    },
    cosmetics: {
      type: [String],
      default: []
    },
    premiumCurrency: {
      type: Number,
      default: 0,
      min: 0
    },
    seedPacks: {
      type: Number,
      default: 0,
      min: 0
    },
    claimedGrantIds: {
      type: [String],
      default: []
    }
  },
  { timestamps: true }
);

export const PlayerInventory = mongoose.model('PlayerInventory', playerInventorySchema);
