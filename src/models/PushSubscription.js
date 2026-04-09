import mongoose from 'mongoose';

const pushSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    endpoint: {
      type: String,
      required: true,
      trim: true
    },
    keys: {
      p256dh: {
        type: String,
        required: true,
        trim: true
      },
      auth: {
        type: String,
        required: true,
        trim: true
      }
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 512,
      default: ''
    },
    lastSuccessAt: {
      type: Date,
      default: null
    },
    lastFailureAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ endpoint: 1 }, { unique: true });

export const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);
