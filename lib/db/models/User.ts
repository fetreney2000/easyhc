import mongoose, { Schema, Model } from "mongoose";
import { IUser, ROLES } from "../types";

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    jawatanInfo: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ROLES,
      required: true,
      default: "user",
    },
    jabatanId: {
      type: Schema.Types.ObjectId,
      ref: "Jabatan",
    },
    unitId: {
      type: Schema.Types.ObjectId,
      ref: "Unit",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    sessionVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ role: 1 });
UserSchema.index({ unitId: 1 });
UserSchema.index({ jabatanId: 1 });

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;