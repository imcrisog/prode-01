import { NextResponse } from "next/server";
import { z } from "zod";
import { connectMongo } from "../../../lib/mongodb";
import { SessionModel } from "../../../lib/models/Session";
import { CartonPurchaseModel } from "../../../lib/models/CartonPurchase";

export const runtime = "nodejs";

function getCookie(req: Request, name: string) {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1];
}

async function getAuthedUserId(req: Request): Promise<string | null> {
  if (!process.env.MONGODB_URI) return null;
  const token = getCookie(req, "prode_session");
  if (!token) return null;
  await connectMongo();
  const session = await SessionModel.findOne({ token }).lean();
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await SessionModel.deleteOne({ token });
    return null;
  }
  return session.userId;
}

const BodySchema = z.object({
  purchaseId: z.string().min(6),
});

// Cierra/bloquea un cartón comprado para que ya no se pueda editar.
export async function POST(req: Request) {
  try {
    const userId = await getAuthedUserId(req);
    if (!userId) return new NextResponse("No autorizado", { status: 401 });

    const body = BodySchema.parse(await req.json());

    const updated = await CartonPurchaseModel.findOneAndUpdate(
      {
        purchaseId: body.purchaseId,
        userId,
        // si ya estaba cerrado, no lo tocamos
        $or: [{ lockedAt: null }, { lockedAt: { $exists: false } }],
      },
      { $set: { lockedAt: new Date() } },
      { new: true },
    ).lean();

    // Si no se actualizó puede ser: no existe, no pertenece, o ya estaba cerrado.
    const exists = await CartonPurchaseModel.findOne({ purchaseId: body.purchaseId, userId }).lean();
    if (!exists) return new NextResponse("No encontrado", { status: 404 });

    return NextResponse.json({ ok: true, purchaseId: body.purchaseId, closed: Boolean((updated ?? exists).lockedAt) });
  } catch (e) {
    if (e instanceof z.ZodError) return new NextResponse(e.message, { status: 400 });
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 500 });
  }
}
