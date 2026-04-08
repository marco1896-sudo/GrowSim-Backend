import mongoose from 'mongoose';

const rewardPayloadSchema = new mongoose.Schema(
  {
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
    }
  },
  { _id: false }
);

const rewardDefinitionSchema = new mongoose.Schema(
  {
    rewardKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },
    tier: {
      type: String,
      required: true,
      enum: ['participation', 'top_50', 'top_25', 'top_10', 'top_1'],
      index: true
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 400
    },
    rewards: {
      type: rewardPayloadSchema,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
);

export const RewardDefinition = mongoose.model('RewardDefinition', rewardDefinitionSchema);
