import mongoose, { Schema } from "mongoose";

export type SessionDoc = {
  token: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
};

const SessionSchema = new Schema<SessionDoc>(
  {
    token: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// TTL index: Mongo borrará sesiones expiradas
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel =
  (mongoose.models.ProdeSession as mongoose.Model<SessionDoc>) ||
  mongoose.model<SessionDoc>("ProdeSession", SessionSchema);
