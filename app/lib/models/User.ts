import mongoose, { Schema } from "mongoose";

export type UserDoc = {
  id: string; // mismo id que usa localdb (string)
  name?: string;
  email?: string;
  passwordHash?: string;
  passwordSalt?: string;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
};

const UserSchema = new Schema<UserDoc>(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String },
    email: { type: String, index: true },
    passwordHash: { type: String },
    passwordSalt: { type: String },
    balance: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export const UserModel =
  (mongoose.models.ProdeUser as mongoose.Model<UserDoc>) ||
  mongoose.model<UserDoc>("ProdeUser", UserSchema);
