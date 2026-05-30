import { NextResponse } from "next/server";
import { connectMongo } from "../../../lib/mongodb";

export async function GET() {
  try {
    await connectMongo();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "error" },
      { status: 500 }
    );
  }
}
