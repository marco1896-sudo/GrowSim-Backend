import mongoose from 'mongoose';

const runSessionSchema = new mongoose.Schema(
  {
    sessionId: {
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
    startedAt: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ['active', 'submitted', 'verified', 'rejected', 'under_review'],
      default: 'active',
      index: true
    },
    declaredSetup: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    declaredChallenges: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    clientVersion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

runSessionSchema.index({ userId: 1, sessionId: 1 });
runSessionSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const RunSession = mongoose.model('RunSession', runSessionSchema);
