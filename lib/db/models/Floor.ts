import mongoose, { Schema, Model } from "mongoose";
import crypto from "crypto";
import { IFloor } from "../types";

const FloorSchema = new Schema<IFloor>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    qrToken: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomUUID(),
    },
    // Identity colour hue (0-359), assigned at creation (golden angle) —
    // see IFloor in lib/db/types.ts
    hue: {
      type: Number,
      required: true,
      min: 0,
      max: 359,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// qrToken uniqueness comes from `unique: true` on the field above
const Floor: Model<IFloor> =
  mongoose.models.Floor || mongoose.model<IFloor>("Floor", FloorSchema);

export default Floor;