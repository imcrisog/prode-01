import mongoose, { Schema } from "mongoose";

export type CartonPurchaseDoc = {
  purchaseId: string;
  userId: string;
  kind: "classic15" | "mega30";
  price: number;
  status: "paid";
  lockedAt?: Date | null;
  cartonId?: number;
  cartonTitle?: string | null;
  numberDate?: number;
  cartonType?: string;
  purchaseDeadline?: Date | null;
  matches?: {
    index: number;
    local_name: string;
    visit_name: string;
    category?: string;
    timetoplay?: string;
    local_logo_url?: string;
    visit_logo_url?: string;
  }[];
  picks?: { matchId: number; pick: "1" | "X" | "2" }[];
  createdAt: Date;
  updatedAt: Date;
};

const CartonPurchaseSchema = new Schema<CartonPurchaseDoc>(
  {
    purchaseId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    kind: { type: String, required: true, enum: ["classic15", "mega30"] },
    price: { type: Number, required: true },
    status: { type: String, required: true, enum: ["paid"], default: "paid" },
    lockedAt: { type: Date, required: false, default: null, index: true },
    cartonId: { type: Number, required: false, index: true },
    cartonTitle: { type: String, required: false },
    numberDate: { type: Number, required: false, index: true },
    cartonType: { type: String, required: false },
    purchaseDeadline: { type: Date, required: false },
    matches: {
      type: [
        new Schema(
          {
            index: { type: Number, required: true },
            local_name: { type: String, required: true },
            visit_name: { type: String, required: true },
            category: { type: String, required: false },
            timetoplay: { type: String, required: false },
            local_logo_url: { type: String, required: false },
            visit_logo_url: { type: String, required: false },
          },
          { _id: false },
        ),
      ],
      required: false,
      default: [],
    },
    picks: {
      type: [
        new Schema(
          {
            matchId: { type: Number, required: true },
            pick: { type: String, required: true, enum: ["1", "X", "2"] },
          },
          { _id: false },
        ),
      ],
      required: false,
      default: [],
    },
  },
  { timestamps: true },
);

export const CartonPurchaseModel =
  (() => {
    // En dev / hot-reload, el modelo puede quedar cacheado con un schema viejo.
    // Si eso pasa, Mongoose puede ignorar updates a paths nuevos (ej: `picks`).
    // Para evitarlo, si detectamos que el schema cacheado no tiene `picks`, lo recreamos.
    const name = "ProdeCartonPurchase";
    const existing = mongoose.models[name] as mongoose.Model<CartonPurchaseDoc> | undefined;

    // Si el schema cacheado no tiene campos nuevos, se recrea.
    if (existing && (!existing.schema.path("picks") || !existing.schema.path("matches"))) {
      delete mongoose.models[name];
    }

    return (
      (mongoose.models[name] as mongoose.Model<CartonPurchaseDoc>) ||
      mongoose.model<CartonPurchaseDoc>(name, CartonPurchaseSchema)
    );
  })();
