import { NextResponse } from "next/server";
import { connectMongo } from "../../../lib/mongodb";
import { SessionModel } from "../../../lib/models/Session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const token = req.headers.get("cookie")?.match(/prode_session=([^;]+)/)?.[1];
    if (process.env.MONGODB_URI && token) {
      try {
        await connectMongo();
        await SessionModel.deleteOne({ token });
      } catch {
        // ignore
      }
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set({
      name: "prode_session",
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(0),
    });
    return res;
  } catch (e) {
    console.error("[auth/logout] error", e);
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 500 });
  }
}
