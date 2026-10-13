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

/**
 * Backstop for the identity hue: the POST route assigns it (golden angle,
 * spaced off every existing hue), but any other creation path — seeds,
 * scripts — and any doc written BEFORE hues existed (renames and QR
 * rotations call save() on hydrated docs, and `required` is validated on
 * save) must never fail or save a floor without a colour.
 */
FloorSchema.pre("save", async function (next) {
  if (this.hue !== undefined && this.hue !== null) return next();
  try {
    const count = await (this.constructor as Model<IFloor>).countDocuments();
    this.hue = (count * 137) % 360;
    next();
  } catch (err) {
    next(err as Error);
  }
});

const Floor: Model<IFloor> =
  mongoose.models.Floor || mongoose.model<IFloor>("Floor", FloorSchema);

export default Floor;