import mongoose from 'mongoose';

const scoreResultSchema = new mongoose.Schema(
  {
    harvestScore: { type: Number, required: true, min: 0, max: 100 },
    yieldScore: { type: Number, required: true, min: 0, max: 100 },
    qualityScore: { type: Number, required: true, min: 0, max: 100 },
    stabilityScore: { type: Number, required: true, min: 0, max: 100 },
    efficiencyScore: { type: Number, required: true, min: 0, max: 100 },
    challengeScore: { type: Number, required: true, min: 0, max: 100 }
  },
  { _id: false }
);

const runVerificationSchema = new mongoose.Schema(
  {
    submissionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },
    verificationStatus: {
      type: String,
      enum: ['submitted', 'provisional', 'verified', 'rejected', 'under_review'],
      required: true,
      index: true
    },
    provisionalResult: {
      type: scoreResultSchema,
      default: null
    },
    verifiedResult: {
      type: scoreResultSchema,
      default: null
    },
    anomalyFlags: {
      type: [String],
      default: []
    },
    confidence: {
      type: Number,
      default: 0,
      min: 0,
      max: 1
    },
    reviewNeeded: {
      type: Boolean,
      default: false
    },
    validationNotes: {
      type: [String],
      default: []
    }
  },
  { timestamps: true }
);

runVerificationSchema.index({ verificationStatus: 1, updatedAt: -1 });

export const RunVerification = mongoose.model('RunVerification', runVerificationSchema);
