import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 320
    },
    passwordHash: {
      type: String,
      required: true
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: ''
    },
    role: {
      type: String,
      enum: ['user', 'tester', 'moderator', 'admin'],
      default: 'user',
      index: true
    },
    isBanned: {
      type: Boolean,
      default: false,
      index: true
    },
    badges: {
      type: [String],
      default: []
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ''
    },
    lastLoginAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
