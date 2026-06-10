import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectMongo } from "../../../lib/mongodb";
import { SessionModel } from "../../../lib/models/Session";
import { UserModel } from "../../../lib/models/User";
import { CartonPurchaseModel } from "../../../lib/models/CartonPurchase";

export const runtime = "nodejs";

const BACKEND_BASE_URL = "https://admin.vedo.com.ar";

const DEFAULT_HEADERS = {
  accept: "application/json",
  // Cloudflare/Apache a veces responde distinto según UA.
  // Con UA tipo navegador devuelve JSON; con UA default de Node puede devolver 404/html.
  "user-agent": "Mozilla/5.0 (compatible; ProdeBot/1.0; +https://example.com)",
} as const;

function getCookie(req: Request, name: string) {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1];
}

const BodySchema = z.object({
  cartonId: z.number().int().positive(),
  cartonSnapshot: z
    .object({
      id: z.number().int().positive(),
      title: z.string().nullable().optional(),
      number_date: z.number().int().optional(),
      type: z.string().optional(),
      price_ars: z.number().int().nonnegative(),
      purchase_deadline: z.string().nullable().optional(),
      matches: z
        .array(
          z
            .object({
              local_name: z.string().optional(),
              visit_name: z.string().optional(),
              category: z.string().optional(),
              timetoplay: z.string().nullable().optional(),
              local_logo_url: z.string().optional(),
              visit_logo_url: z.string().optional(),
            })
            .passthrough(),
        )
        .optional(),
    })
    .optional(),
});

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function makeId() {
  return `${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

function isClosedNow(purchaseDeadline: unknown): boolean {
  if (!purchaseDeadline) return false;
  const d = new Date(String(purchaseDeadline));
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() <= Date.now();
}

export async function POST(req: Request) {
  try {
    if (!process.env.MONGODB_URI) {
      return new NextResponse("MONGODB_URI no configurado", { status: 500 });
    }

    const token = getCookie(req, "prode_session");
    if (!token) return new NextResponse("No autorizado", { status: 401 });

    const body = BodySchema.parse(await req.json());

    // Buscar el cartón en el backend y tomar precio/matches desde ahí.
    // IMPORTANTE: en algunos entornos (ej Vercel) Cloudflare puede bloquear requests server-to-server (403 challenge).
    // Por eso soportamos un fallback con `cartonSnapshot` (enviado por el cliente) para que el flujo no se rompa.
    let cartonRec: Record<string, unknown> | null = null;
    try {
      const backendRes = await fetch(`${BACKEND_BASE_URL}/api/prode/cartones`, {
        cache: "no-store",
        redirect: "follow",
        headers: DEFAULT_HEADERS,
      });
      const backendText = await backendRes.text();

      if (backendRes.ok) {
        const backendJson = JSON.parse(backendText) as { data?: unknown };
        const cartonesRaw = Array.isArray(backendJson.data) ? backendJson.data : [];
        cartonRec =
          cartonesRaw
            .map(asRecord)
            .find((c) => c && Number(c.id) === body.cartonId) ?? null;
      } else {
        // Si viene snapshot, intentamos seguir. Si no, devolvemos el error del backend.
        if (!body.cartonSnapshot) {
          return NextResponse.json(
            {
              ok: false,
              message: "Error consultando backend /api/prode/cartones",
              status: backendRes.status,
              body: backendText?.slice(0, 500) ?? "",
            },
            { status: 502 },
          );
        }
        console.warn("[api/carton/buy] backend blocked; using cartonSnapshot fallback", {
          status: backendRes.status,
          cartonId: body.cartonId,
        });
      }
    } catch (e) {
      if (!body.cartonSnapshot) {
        const msg = e instanceof Error ? e.message : "fetch failed";
        return NextResponse.json(
          { ok: false, message: "Error consultando backend /api/prode/cartones", status: 0, body: msg },
          { status: 502 },
        );
      }
      console.warn("[api/carton/buy] backend fetch failed; using cartonSnapshot fallback", {
        cartonId: body.cartonId,
      });
    }

    if (!cartonRec) {
      if (!body.cartonSnapshot || body.cartonSnapshot.id !== body.cartonId) {
        return new NextResponse("Cartón no encontrado", { status: 404 });
      }
      cartonRec = {
        id: body.cartonSnapshot.id,
        title: body.cartonSnapshot.title,
        number_date: body.cartonSnapshot.number_date,
        type: body.cartonSnapshot.type,
        price_ars: body.cartonSnapshot.price_ars,
        purchase_deadline: body.cartonSnapshot.purchase_deadline,
        matches: body.cartonSnapshot.matches ?? [],
      };
    }

    // Validación en tiempo real: si ya cerró, no se puede comprar.
    // Esto es lo importante para seguridad (aunque el front lo oculte).
    if (isClosedNow(cartonRec.purchase_deadline)) {
      return new NextResponse("Cartón cerrado", { status: 400 });
    }

    const price = Number(cartonRec.price_ars ?? 0);
    if (!Number.isFinite(price) || price <= 0) {
      return new NextResponse("Precio inválido", { status: 400 });
    }

    await connectMongo();

    const session = await SessionModel.findOne({ token }).lean();
    if (!session) return new NextResponse("No autorizado", { status: 401 });
    if (session.expiresAt.getTime() <= Date.now()) {
      await SessionModel.deleteOne({ token });
      return new NextResponse("No autorizado", { status: 401 });
    }

    const userId = session.userId;
    const purchaseId = makeId();

    const mongoSession = await mongoose.startSession();
    let newBalance = 0;

    await mongoSession.withTransaction(async () => {
      const user = await UserModel.findOne({ id: userId }).session(mongoSession);
      if (!user) throw new Error("Usuario no encontrado");
      if ((user.balance ?? 0) < price) throw new Error("Saldo insuficiente");

      await UserModel.updateOne(
        { id: userId },
        { $inc: { balance: -price } },
        { session: mongoSession },
      );

      const cartonType = String(cartonRec.type ?? "");
      const matchesRaw = asRecord(cartonRec)?.matches;

      await CartonPurchaseModel.create(
        [
          {
            purchaseId,
            userId,
            kind: cartonType === "5" || cartonType === "classic5" ? "mega30" : "classic15",
            price,
            status: "paid",
            cartonId: Number(cartonRec.id),
            cartonTitle: (cartonRec.title as string | null | undefined) ?? null,
            numberDate: Number(cartonRec.number_date ?? 0) || undefined,
            cartonType,
            purchaseDeadline: cartonRec.purchase_deadline
              ? new Date(String(cartonRec.purchase_deadline))
              : null,
            matches: Array.isArray(matchesRaw)
              ? matchesRaw
                  .map(asRecord)
                  .filter(Boolean)
                  .map((m, idx: number) => ({
                    index: idx + 1,
                    local_name: String(m!.local_name ?? ""),
                    visit_name: String(m!.visit_name ?? ""),
                    category: m!.category ? String(m!.category) : undefined,
                    timetoplay: m!.timetoplay ? String(m!.timetoplay) : undefined,
                    local_logo_url: m!.local_logo_url ? String(m!.local_logo_url) : undefined,
                    visit_logo_url: m!.visit_logo_url ? String(m!.visit_logo_url) : undefined,
                  }))
              : [],
          },
        ],
        { session: mongoSession },
      );

      const updatedUser = await UserModel.findOne({ id: userId }).session(mongoSession);
      newBalance = updatedUser?.balance ?? 0;
    });

    mongoSession.endSession();

    return NextResponse.json({ ok: true, purchaseId, balance: newBalance });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return new NextResponse(e.message, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Error";
    return new NextResponse(msg, { status: msg === "Saldo insuficiente" ? 400 : 500 });
  }
}
