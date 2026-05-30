import mongoose, { Schema } from "mongoose";

export type DepositDoc = {
  depositId: string; // external_reference
  userId: string;
  amount: number;
  status: "pending" | "approved";
  mpPaymentId?: string;
  mpStatus?: string;
  signatureVerified?: boolean;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const DepositSchema = new Schema<DepositDoc>(
  {
    depositId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    status: { type: String, required: true, enum: ["pending", "approved"], default: "pending" },
    mpPaymentId: { type: String },
    mpStatus: { type: String },
    signatureVerified: { type: Boolean },
    verifiedAt: { type: Date },
  },
  { timestamps: true },
);

export const DepositModel =
  (mongoose.models.ProdeDeposit as mongoose.Model<DepositDoc>) ||
  mongoose.model<DepositDoc>("ProdeDeposit", DepositSchema);
