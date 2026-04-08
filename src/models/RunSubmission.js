import mongoose from 'mongoose';

const runSubmissionSchema = new mongoose.Schema(
  {
    submissionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },
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
    endedAt: {
      type: Date,
      required: true
    },
    endReason: {
      type: String,
      required: true,
      trim: true,
      enum: ['completed', 'failed', 'aborted', 'timeout']
    },
    clientVersion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    declaredSetup: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    declaredChallenges: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    clientSummary: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    telemetry: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    clientHashes: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    status: {
      type: String,
      enum: ['submitted', 'provisional', 'verified', 'rejected', 'under_review'],
      required: true,
      index: true
    }
  },
  { timestamps: true }
);

runSubmissionSchema.index({ userId: 1, submissionId: 1 });
runSubmissionSchema.index({ userId: 1, sessionId: 1 });
runSubmissionSchema.index(
  { sessionId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['provisional', 'verified', 'rejected', 'under_review'] }
    }
  }
);

export const RunSubmission = mongoose.model('RunSubmission', runSubmissionSchema);
