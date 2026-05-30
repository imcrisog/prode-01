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

function isClosedNow(purchaseDeadline: unknown): boolean {
  if (!purchaseDeadline) return false;
  const d = new Date(String(purchaseDeadline));
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() <= Date.now();
}

function isAnyMatchStarted(matches: unknown): boolean {
  if (!Array.isArray(matches)) return false;
  for (const m of matches) {
    if (!m || typeof m !== "object") continue;
    const tt = (m as Record<string, unknown>).timetoplay;
    if (!tt) continue;
    const d = new Date(String(tt));
    if (!Number.isNaN(d.getTime()) && d.getTime() <= Date.now()) return true;
  }
  return false;
}

function isLocked(purchase: { lockedAt?: Date | null } | null | undefined): boolean {
  return Boolean(purchase?.lockedAt);
}

const QuerySchema = z.object({
  purchaseId: z.string().min(6),
});

const BodySchema = z.object({
  purchaseId: z.string().min(6),
  picks: z
    .array(
      z.object({
        matchId: z.number().int().min(1),
        pick: z.enum(["1", "X", "2"]),
      }),
    )
    .min(1)
    .max(30),
});

export async function GET(req: Request) {
  try {
    const userId = await getAuthedUserId(req);
    if (!userId) return new NextResponse("No autorizado", { status: 401 });

    const url = new URL(req.url);
    const { purchaseId } = QuerySchema.parse({ purchaseId: url.searchParams.get("purchaseId") });

    const purchase = await CartonPurchaseModel.findOne({ purchaseId, userId }).lean();
    if (!purchase) return new NextResponse("No encontrado", { status: 404 });

    const closed = isLocked(purchase) || isClosedNow(purchase.purchaseDeadline) || isAnyMatchStarted(purchase.matches);

    return NextResponse.json({
      ok: true,
      purchaseId,
      picks: purchase.picks ?? [],
      matches: purchase.matches ?? [],
      closed,
    });
  } catch (e) {
    if (e instanceof z.ZodError) return new NextResponse(e.message, { status: 400 });
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getAuthedUserId(req);
    if (!userId) return new NextResponse("No autorizado", { status: 401 });

    const body = BodySchema.parse(await req.json());

    const purchase = await CartonPurchaseModel.findOne({ purchaseId: body.purchaseId, userId }).lean();
    if (!purchase) return new NextResponse("No encontrado", { status: 404 });

    // Regla de negocio: si el cartón ya cerró (por deadline o porque ya empezó algún partido)
    // no se pueden modificar los pronósticos.
    if (isLocked(purchase) || isClosedNow(purchase.purchaseDeadline) || isAnyMatchStarted(purchase.matches)) {
      return new NextResponse("Cartón cerrado", { status: 400 });
    }

    const maxMatches = Array.isArray(purchase.matches) ? purchase.matches.length : 0;
    if (maxMatches <= 0) return new NextResponse("El cartón no tiene partidos", { status: 400 });

    // Asegurar que no vengan duplicados
    const map = new Map<number, "1" | "X" | "2">();
    for (const p of body.picks) {
      if (p.matchId < 1 || p.matchId > maxMatches) {
        return new NextResponse("MatchId fuera de rango", { status: 400 });
      }
      map.set(p.matchId, p.pick);
    }
    const normalized = Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([matchId, pick]) => ({ matchId, pick }));

    const updated = await CartonPurchaseModel.findOneAndUpdate(
      { purchaseId: body.purchaseId, userId },
      { $set: { picks: normalized } },
      { new: true },
    ).lean();

    if (!updated) return new NextResponse("No encontrado", { status: 404 });

    return NextResponse.json({ ok: true, purchaseId: body.purchaseId, picks: updated.picks ?? [] });
  } catch (e) {
    if (e instanceof z.ZodError) return new NextResponse(e.message, { status: 400 });
    const msg = e instanceof Error ? e.message : "Error";
    return new NextResponse(msg, { status: 500 });
  }
}
