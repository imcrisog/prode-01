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
      return NextResponse.json({ user: null, source: "no-mongo" });
    }

    const token = getCookie(req, "prode_session");
    if (!token) return NextResponse.json({ user: null });

    await connectMongo();
    const session = await SessionModel.findOne({ token }).lean();
    if (!session) return NextResponse.json({ user: null });
    if (session.expiresAt.getTime() <= Date.now()) {
      await SessionModel.deleteOne({ token });
      return NextResponse.json({ user: null });
    }

    const user = await UserModel.findOne({ id: session.userId }).lean();
    if (!user) return NextResponse.json({ user: null });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        balance: user.balance ?? 0,
      },
    });
  } catch (e) {
    console.error("[auth/me] error", e);
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 500 });
  }
}
