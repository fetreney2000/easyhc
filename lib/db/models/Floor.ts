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

FloorSchema.index({ qrToken: 1 }, { unique: true });

const Floor: Model<IFloor> =
  mongoose.models.Floor || mongoose.model<IFloor>("Floor", FloorSchema);

export default Floor;