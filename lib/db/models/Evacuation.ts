import mongoose, { Schema, Model } from "mongoose";
import { IEvacuation, IRosterEntry } from "../types";
// Populate safety (see Attendance.ts): these refs are resolved at snapshot
// time by lib/evacuation.ts, which imports the models directly.
import "./User";
import "./Floor";
import "./Attendance";

const RosterEntrySchema = new Schema<IRosterEntry>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    visitorAttendanceId: { type: Schema.Types.ObjectId, ref: "Attendance" },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["employee", "visitor"], required: true },
    floorId: { type: Schema.Types.ObjectId, ref: "Floor" },
    floorName: { type: String, trim: true },
    confirmedAt: { type: Date },
    confirmedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { _id: true }
);

const EvacuationSchema = new Schema<IEvacuation>(
  {
    status: {
      type: String,
      enum: ["active", "closed"],
      required: true,
      default: "active",
    },
    startedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    startedByName: { type: String, required: true, trim: true },
    startedAt: { type: Date, required: true, default: Date.now },
    closedAt: { type: Date },
    roster: { type: [RosterEntrySchema], default: [] },
  },
  { timestamps: true }
);

// Two simultaneous "start" presses must yield ONE session: the loser gets
// E11000 (surfaced as 409) instead of a second active session. Only one
// ACTIVE session is unique — closed sessions accumulate as history.
EvacuationSchema.index(
  { status: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);
// "Last closed" summary shown on the /evacuation page (one-liner for roles
// without the report history table)
EvacuationSchema.index({ status: 1, closedAt: -1 });

const Evacuation: Model<IEvacuation> =
  mongoose.models.Evacuation ||
  mongoose.model<IEvacuation>("Evacuation", EvacuationSchema);

export default Evacuation;
