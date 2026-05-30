import { NextResponse } from "next/server";
import { connectMongo } from "../../../lib/mongodb";
import { SessionModel } from "../../../lib/models/Session";
import { UserModel } from "../../../lib/models/User";

export const runtime = "nodejs";

function getCookie(req: Request, name: string) {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1];
}

export async function GET(req: Request) {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ ok: true, balance: 0, source: "no-mongo" });
    }

    const token = getCookie(req, "prode_session");
    if (!token) return new NextResponse("No autorizado", { status: 401 });

    await connectMongo();

    const session = await SessionModel.findOne({ token }).lean();
    if (!session) return new NextResponse("No autorizado", { status: 401 });
    if (session.expiresAt.getTime() <= Date.now()) {
      await SessionModel.deleteOne({ token });
      return new NextResponse("No autorizado", { status: 401 });
    }

    const user = await UserModel.findOne({ id: session.userId }).lean();
    return NextResponse.json({ ok: true, balance: user?.balance ?? 0, source: "mongo" });
  } catch (e) {
    console.error("[api/wallet/balance] error", e);
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 500 });
  }
}
