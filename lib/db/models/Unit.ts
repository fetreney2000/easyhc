import mongoose, { Schema, Model } from "mongoose";
import { IUnit } from "../types";

const UnitSchema = new Schema<IUnit>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    jabatanId: {
      type: Schema.Types.ObjectId,
      ref: "Jabatan",
      required: true,
    },
    homeFloorId: {
      type: Schema.Types.ObjectId,
      ref: "Floor",
    },
  },
  {
    timestamps: true,
  }
);

UnitSchema.index({ jabatanId: 1 });

const Unit: Model<IUnit> =
  mongoose.models.Unit || mongoose.model<IUnit>("Unit", UnitSchema);

export default Unit;