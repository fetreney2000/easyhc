import mongoose, { Schema, Model } from "mongoose";
import { IAttendance } from "../types";

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
    visitorDept: {
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

const Attendance: Model<IAttendance> =
  mongoose.models.Attendance ||
  mongoose.model<IAttendance>("Attendance", AttendanceSchema);

export default Attendance;