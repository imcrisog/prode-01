import { NextResponse } from "next/server";
import { z } from "zod";
import { connectMongo } from "../../../lib/mongodb";
import { UserModel } from "../../../lib/models/User";
import { SessionModel } from "../../../lib/models/Session";
import { hashPassword, makeSessionToken } from "../../../lib/auth";

export const runtime = "nodejs";

const BodySchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    if (!process.env.MONGODB_URI) {
      return new NextResponse("MONGODB_URI no configurado", { status: 500 });
    }

    const body = BodySchema.parse(await req.json());
    const email = body.email.trim().toLowerCase();

    await connectMongo();

    const existing = await UserModel.findOne({ email }).lean();
    if (existing) {
      return new NextResponse("Ya existe una cuenta con ese email", { status: 400 });
    }

    const { salt, hash } = hashPassword(body.password);
    const userId = cryptoRandomId();

    await UserModel.create({
      id: userId,
      name: body.name.trim(),
      email,
      passwordSalt: salt,
      passwordHash: hash,
      balance: 0,
    });

    const token = makeSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await SessionModel.create({ token, userId, expiresAt });

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
    console.error("[auth/register] error", e);
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 500 });
  }
}

function cryptoRandomId() {
  // Sin dependencia extra: id string similar al que usábamos en demo
  return `${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}
