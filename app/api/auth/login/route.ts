import { NextResponse } from "next/server";
import { z } from "zod";
import { connectMongo } from "../../../lib/mongodb";
import { UserModel } from "../../../lib/models/User";
import { SessionModel } from "../../../lib/models/Session";
import { makeSessionToken, verifyPassword } from "../../../lib/auth";

export const runtime = "nodejs";

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    if (!process.env.MONGODB_URI) {
      return new NextResponse("MONGODB_URI no configurado", { status: 500 });
    }

    const body = BodySchema.parse(await req.json());
    const email = body.email.trim().toLowerCase();

    await connectMongo();
    const user = await UserModel.findOne({ email }).lean();
    if (!user) return new NextResponse("Credenciales inválidas", { status: 401 });

    const ok = verifyPassword({
      password: body.password,
      salt: user.passwordSalt,
      hash: user.passwordHash,
    });
    if (!ok) return new NextResponse("Credenciales inválidas", { status: 401 });

    const token = makeSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await SessionModel.create({ token, userId: user.id, expiresAt });

    const res = NextResponse.json({ ok: true });
    res.cookies.set({
      name: "prode_session",
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    });
    return res;
  } catch (e) {
    if (e instanceof z.ZodError) {
      return new NextResponse(e.message, { status: 400 });
    }
    console.error("[auth/login] error", e);
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 500 });
  }
}
