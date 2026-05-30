import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  // No tiramos error para permitir correr la demo sin DB.
  // Los endpoints que la necesiten pueden chequearlo.
}

let cached = (global as unknown as { mongooseConn?: typeof mongoose }).mongooseConn;

export async function connectMongo() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI no configurado");
  }
  if (cached) return cached;

  const dbName = process.env.DB_NAME;
  cached = await mongoose.connect(MONGODB_URI, {
    ...(dbName ? { dbName } : {}),
  });
  (global as unknown as { mongooseConn?: typeof mongoose }).mongooseConn = cached;
  return cached;
}
