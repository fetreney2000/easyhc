import mongoose, { Schema, Model } from "mongoose";
import { IAttendance } from "../types";
// Populate safety: userId/floorId reference these models, and populate()
// throws MissingSchemaError if the ref target has not been registered in
// this module graph. Importing them here means any route using Attendance
// can populate without importing the targets itself.
import "./User";
import "./Floor";

const AttendanceSchema = new Schema<IAttendance>(
  {
    type: {
      type: String,
      enum: ["employee", "visitor"],
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    visitorName: {
      type: String,
      trim: true,
    },
    // Normalised (digits only, local format) — the identity used to stop a
    // visitor from being checked in twice while already present
    visitorPhone: {
      type: String,
      trim: true,
    },
    floorId: {
      type: Schema.Types.ObjectId,
      ref: "Floor",
      required: true,
    },
    checkedInAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    checkedOutAt: {
      type: Date,
    },
    checkedOutBy: {
      type: String, // "self" or admin userId string
    },
    method: {
      type: String,
      enum: ["qr", "manual"],
      required: true,
      default: "qr",
    },
  },
  {
    timestamps: true,
  }
);

// Critical indexes per spec section 3
AttendanceSchema.index({ floorId: 1, checkedOutAt: 1 });
AttendanceSchema.index({ userId: 1, checkedOutAt: 1 });
AttendanceSchema.index({ type: 1, checkedOutAt: 1 });
// "is this phone already checked in?" runs on every visitor check-in
AttendanceSchema.index({ type: 1, visitorPhone: 1, checkedOutAt: 1 });
// Reports filter and sort on checkedInAt
AttendanceSchema.index({ checkedInAt: -1 });
/**
 * ONE OPEN visitor check-in per phone — the atomic backstop for the
 * pre-check in /api/visitor/checkin: two simultaneous submits can both pass
 * a findOne() and both insert. The index is partial, so closed records
 * (checkedOutAt set), employee rows and records without a phone are excluded
 * and history stays unaffected.
 */
AttendanceSchema.index(
  { type: 1, visitorPhone: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: "visitor",
      visitorPhone: { $type: "string" },
      checkedOutAt: null,
    },
  }
);

const Attendance: Model<IAttendance> =
  mongoose.models.Attendance ||
  mongoose.model<IAttendance>("Attendance", AttendanceSchema);

export default Attendance;