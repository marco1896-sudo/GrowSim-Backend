import mongoose from 'mongoose';

const leaderboardEntrySchema = new mongoose.Schema(
  {
    entryId: {
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
    submissionId: {
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
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    rank: {
      type: Number,
      default: null,
      min: 1
    },
    displayNameSnapshot: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    titleSnapshot: {
      type: String,
      default: null,
      trim: true,
      maxlength: 80
    },
    verifiedAt: {
      type: Date,
      required: true,
      index: true
    },
    scoreBreakdown: {
      harvestScore: { type: Number, required: true, min: 0, max: 100 },
      qualityScore: { type: Number, required: true, min: 0, max: 100 },
      stabilityScore: { type: Number, required: true, min: 0, max: 100 }
    }
  },
  { timestamps: true }
);

leaderboardEntrySchema.index({ scope: 1, periodKey: 1, category: 1, rank: 1 });
leaderboardEntrySchema.index({ userId: 1, scope: 1, periodKey: 1, category: 1 }, { unique: true });
leaderboardEntrySchema.index({ submissionId: 1, category: 1 }, { unique: true });

export const LeaderboardEntry = mongoose.model('LeaderboardEntry', leaderboardEntrySchema);
