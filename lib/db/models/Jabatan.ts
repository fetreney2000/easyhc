import mongoose, { Schema, Model } from "mongoose";
import { IJabatan } from "../types";

const JabatanSchema = new Schema<IJabatan>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Jabatan: Model<IJabatan> =
  mongoose.models.Jabatan || mongoose.model<IJabatan>("Jabatan", JabatanSchema);

export default Jabatan;