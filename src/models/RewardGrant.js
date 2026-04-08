import mongoose from 'mongoose';

const rewardSnapshotSchema = new mongoose.Schema(
  {
    rewardKey: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    rewards: {
      badges: { type: [String], default: [] },
      titles: { type: [String], default: [] },
      cosmetics: { type: [String], default: [] },
      premiumCurrency: { type: Number, default: 0, min: 0 },
      seedPacks: { type: Number, default: 0, min: 0 }
    }
  },
  { _id: false }
);

const rewardGrantSchema = new mongoose.Schema(
  {
    grantId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    definitionKey: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    sourceSubmissionId: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    scope: {
      type: String,
      required: true,
      enum: ['weekly'],
      index: true
    },
    periodKey: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    category: {
      type: String,
      required: true,
      enum: ['overall', 'quality'],
      index: true
    },
    tier: {
      type: String,
      required: true,
      enum: ['participation', 'top_50', 'top_25', 'top_10', 'top_1'],
      index: true
    },
    placementRank: {
      type: Number,
      required: true,
      min: 1
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    status: {
      type: String,
      required: true,
      enum: ['claimable', 'claimed'],
      index: true
    },
    rewardSnapshot: {
      type: rewardSnapshotSchema,
      required: true
    },
    leaderboardEligible: {
      type: Boolean,
      default: true
    },
    claimedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

rewardGrantSchema.index({ userId: 1, scope: 1, periodKey: 1, category: 1 }, { unique: true });
rewardGrantSchema.index({ userId: 1, status: 1, updatedAt: -1 });

export const RewardGrant = mongoose.model('RewardGrant', rewardGrantSchema);
