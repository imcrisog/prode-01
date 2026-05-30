import { NextResponse } from "next/server";
import MercadoPagoConfig, { Payment } from "mercadopago";
import { z } from "zod";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { connectMongo } from "../../../lib/mongodb";
import { DepositModel } from "../../../lib/models/Deposit";
import { UserModel } from "../../../lib/models/User";

export const runtime = "nodejs";

const BodySchema = z
  .object({
    depositId: z.string().min(5).optional(),
    paymentId: z.union([z.string(), z.number()]).optional(),
    userId: z.string().min(3).optional(),
  })
  .passthrough();

type MpWebhookLike = {
  type?: string;
  action?: string;
  data?: { id?: string | number };
};

function parseMpSignatureHeader(header: string | null): { ts?: string; v1?: string } {
  if (!header) return {};
  // Esperado: "ts=...,v1=..." (puede venir con espacios)
  const out: { ts?: string; v1?: string } = {};
  for (const part of header.split(",")) {
    const [kRaw, vRaw] = part.split("=");
    const k = kRaw?.trim();
    const v = vRaw?.trim();
    if (!k || !v) continue;
    if (k === "ts") out.ts = v;
    if (k === "v1") out.v1 = v;
  }
  return out;
}

function verifyMpWebhookSignature(input: {
  secret: string;
  signatureHeader: string | null;
  requestId: string | null;
  dataId?: string;
}): boolean {
  const { ts, v1 } = parseMpSignatureHeader(input.signatureHeader);
  if (!ts || !v1 || !input.requestId || !input.dataId) return false;

  // Mercado Pago: string a firmar (según documentación) 
  // id:{data.id};request-id:{x-request-id};ts:{ts};
  const manifest = `id:${input.dataId};request-id:${input.requestId};ts:${ts};`;
  const computed = crypto
    .createHmac("sha256", input.secret)
    .update(manifest)
    .digest("hex")
    .toLowerCase();

  const normalized = v1.toLowerCase().replace(/^sha256=/, "");
  if (normalized.length !== computed.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(normalized));
}

function getPaymentIdFromUnknown(input: unknown): string | undefined {
  if (!input) return undefined;
  if (typeof input === "string" || typeof input === "number") return String(input);
  return undefined;
}

function stringifyUnknownError(e: unknown) {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

// MP puede notificar por GET o POST dependiendo del modo/config.
export async function GET(req: Request) {
  return POST(req);
}

export async function POST(req: Request) {
  try {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) {
      return new NextResponse("MP_ACCESS_TOKEN no configurado", { status: 500 });
    }

    // Intentamos parsear JSON; si falla, seguimos con {} y sólo usamos query params.
    let json: unknown = {};
    try {
      json = await req.json();
    } catch {
      json = {};
    }

    const body = BodySchema.parse(json) as z.infer<typeof BodySchema> & MpWebhookLike;

    const url = new URL(req.url);
    const paymentId =
      getPaymentIdFromUnknown(body.paymentId) ||
      getPaymentIdFromUnknown(body.data?.id) ||
      url.searchParams.get("data.id") ||
      url.searchParams.get("id") ||
      undefined;

    // depositId puede venir de nuestro frontend o lo obtenemos de external_reference (vía Payment)
    const depositId =
      body.depositId || url.searchParams.get("external_reference") || undefined;

    // Si es un webhook de MP, normalmente type === "payment".
    // Si no lo es, igual intentamos verificar si viene paymentId.
    const mpType = body.type ?? url.searchParams.get("type") ?? undefined;
    if (mpType && mpType !== "payment") {
      return NextResponse.json({ ok: true, ignored: true, type: mpType });
    }

    // Verificación de firma (si configuraste MP_WEBHOOK_SECRET)
    // - Solo la exigimos para requests con shape de webhook (type/payment o data.id)
    // - Para llamadas internas desde el frontend (sin headers), se verifica igual por Payment.get
    const webhookSecret = process.env.MP_WEBHOOK_SECRET;
    const looksLikeWebhook = Boolean(
      body.type || body.data?.id || url.searchParams.get("data.id"),
    );
    if (webhookSecret && looksLikeWebhook) {
      const sig = req.headers.get("x-signature");
      const rid = req.headers.get("x-request-id");

      // En algunos entornos el evento llega sin headers (túneles/proxies).
      // No acreditamos por firma en ese caso, pero seguimos con verificación server-to-server.
      if (!sig || !rid) {
        console.warn("[api/wallet/add] webhook sin headers de firma; se omite verificación por firma");
      } else {
        const ok = verifyMpWebhookSignature({
          secret: webhookSecret,
          signatureHeader: sig,
          requestId: rid,
          dataId: paymentId,
        });
        if (!ok) {
          return new NextResponse("Firma de webhook inválida", { status: 401 });
        }
      }
    }

    if (!paymentId) {
      return new NextResponse("paymentId requerido", { status: 400 });
    }

    const client = new MercadoPagoConfig({ accessToken: token });
    const payment = new Payment(client);

    let info: Awaited<ReturnType<typeof payment.get>>;
    try {
      info = await payment.get({ id: paymentId });
    } catch (e) {
      const msg = stringifyUnknownError(e);
      console.error("[api/wallet/add] Payment.get error", {
        msg,
        paymentId,
        method: req.method,
        url: req.url,
      });

      // Importante: Mercado Pago considera entregado el webhook si respondemos 2xx.
      // Si fallamos acá (token mal, sandbox/prod mismatch, etc) y respondemos 5xx,
      // MP va a reintentar y vas a ver "no me llega" o quedará en cola.
      // Para webhooks respondemos 200 pero dejamos trazas en logs.
      if (looksLikeWebhook) {
        return NextResponse.json(
          { ok: false, error: msg || "No se pudo consultar el pago" },
          { status: 200 },
        );
      }

      return new NextResponse(msg || "No se pudo consultar el pago", { status: 502 });
    }

    const status = info.status ?? undefined;
    const externalRef = (info.external_reference ?? undefined) as string | undefined;
    const meta = (info.metadata ?? {}) as Record<string, unknown>;
    const metaUserId = typeof meta.userId === "string" ? meta.userId : undefined;
    const metaDepositId = typeof meta.depositId === "string" ? meta.depositId : undefined;
    const metaAmount = typeof meta.amount === "number" ? meta.amount : undefined;

    const resolvedDepositId = depositId ?? metaDepositId ?? externalRef;
    if (!resolvedDepositId) {
      return new NextResponse("depositId requerido (o external_reference)", { status: 400 });
    }

    // Verificación de vínculo pago <-> depósito
    if (externalRef && externalRef !== resolvedDepositId) {
      return NextResponse.json(
        {
          ok: false,
          verified: false,
          reason: "external_reference no coincide con depositId",
          payment: { id: String(info.id ?? paymentId), status, external_reference: externalRef },
        },
        { status: 400 },
      );
    }

    // Verificación opcional de userId (si lo envía el cliente)
    if (body.userId && metaUserId && body.userId !== metaUserId) {
      return NextResponse.json(
        {
          ok: false,
          verified: false,
          reason: "metadata.userId no coincide",
          payment: { id: String(info.id ?? paymentId), status, external_reference: externalRef },
        },
        { status: 400 },
      );
    }

    const txAmount = typeof info.transaction_amount === "number" ? info.transaction_amount : 0;
    const amount = metaAmount && metaAmount > 0 ? metaAmount : txAmount;

    const approved = status === "approved";

    if (process.env.NODE_ENV !== "production") {
      console.log("[api/wallet/add]", {
        paymentId,
        status,
        depositId: resolvedDepositId,
        hasMetadataUserId: Boolean(metaUserId),
      });
    }

    // Si hay Mongo configurado, acreditamos de forma idempotente.
    // Nota: el frontend demo sigue acreditando en localStorage; Mongo es el "ledger" real.
    if (process.env.MONGODB_URI && approved) {
      try {
        await connectMongo();

        const session = await mongoose.startSession();
        await session.withTransaction(async () => {
          const dep = await DepositModel.findOne({ depositId: resolvedDepositId }).session(session);
          const amountToCredit = dep?.amount ?? amount;
          const userToCredit = dep?.userId ?? metaUserId ?? body.userId;

          if (!userToCredit) {
            throw new Error(
              "No se pudo determinar el userId para acreditar (falta Deposit en DB y metadata.userId)",
            );
          }

          if (!dep) {
            await DepositModel.create(
              [
                {
                  depositId: resolvedDepositId,
                  userId: userToCredit,
                  amount: amountToCredit,
                  status: "pending",
                },
              ],
              { session },
            );
          }

          // Marcamos como approved solo una vez
          const updated = await DepositModel.findOneAndUpdate(
            { depositId: resolvedDepositId, status: { $ne: "approved" } },
            {
              $set: {
                status: "approved",
                mpPaymentId: String(info.id ?? paymentId),
                mpStatus: status,
                signatureVerified: Boolean(
                  webhookSecret &&
                    looksLikeWebhook &&
                    req.headers.get("x-signature") &&
                    req.headers.get("x-request-id"),
                ),
                verifiedAt: new Date(),
              },
            },
            { session, new: true },
          );

          if (updated) {
            // Acreditamos balance
            await UserModel.updateOne(
              { id: userToCredit },
              {
                // No seteamos balance en $setOnInsert porque también lo incrementamos y Mongo lo toma como conflicto.
                // $inc sobre campo inexistente crea el campo con el valor (lo cual sirve para el alta).
                $setOnInsert: { id: userToCredit },
                $inc: { balance: amountToCredit },
              },
              { session, upsert: true },
            );
          }
        });
        session.endSession();
      } catch (e) {
        console.warn("[api/wallet/add] mongo credit skipped", e);
      }
    }

    // Esto es lo que el frontend usa para acreditar (o mostrar pending/error)
    return NextResponse.json({
      ok: true,
      verified: approved,
      approved,
      payment: {
        id: String(info.id ?? paymentId),
        status,
        transaction_amount: txAmount,
        external_reference: externalRef,
        metadata: info.metadata,
      },
      deposit: {
        depositId: resolvedDepositId,
        userId: metaUserId ?? body.userId,
        amount,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return new NextResponse(e.message, { status: 400 });
    }

    console.error("[api/wallet/add] error", e);
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 500 });
  }
}
