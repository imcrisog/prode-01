import { NextResponse } from "next/server";
import MercadoPagoConfig, { Preference } from "mercadopago";
import { z } from "zod";
import { connectMongo } from "../../../lib/mongodb";
import { DepositModel } from "../../../lib/models/Deposit";
import { UserModel } from "../../../lib/models/User";

export const runtime = "nodejs";

const BodySchema = z.object({
  amount: z.number().int().positive().max(1_000_000),
  depositId: z.string().min(5),
  payerEmail: z.string().email().optional(),
  userId: z.string().min(3).optional(),
});

export async function POST(req: Request) {
  try {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) {
      return new NextResponse("MP_ACCESS_TOKEN no configurado", { status: 500 });
    }

    // Ayuda de debugging en dev (no expone el token)
    if (process.env.NODE_ENV !== "production") {
      console.log("[mp/preference] token present:", Boolean(token));
    }

    const json = await req.json();
    const body = BodySchema.parse(json);

    const origin = req.headers.get("origin") ?? "http://localhost:3000";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? origin;

    const backUrls = {
      success: `${baseUrl}/mp/success?depositId=${encodeURIComponent(body.depositId)}`,
      failure: `${baseUrl}/mp/failure?depositId=${encodeURIComponent(body.depositId)}`,
      pending: `${baseUrl}/mp/pending?depositId=${encodeURIComponent(body.depositId)}`,
    };

    // Webhook: Mercado Pago notificará el estado del pago.
    // NOTA: para verificación fuerte del webhook (firma), haría falta implementar validación
    // de headers que dependen de tu configuración de MP. En esta demo validamos por consulta
    // server-to-server con Payment.get.
    const notificationUrl = `${baseUrl}/api/wallet/add`;

    if (process.env.NODE_ENV !== "production") {
      console.log("[mp/preference] urls", { baseUrl, notificationUrl, backUrls });
      if (baseUrl.includes("localhost")) {
        console.warn(
          "[mp/preference] baseUrl apunta a localhost. Para que Mercado Pago pegue el webhook, setea NEXT_PUBLIC_BASE_URL a tu URL pública https (devtunnels/ngrok).",
        );
      }
    }

    // Persistimos en Mongo (si está configurado) para que /api/wallet/add pueda ser idempotente.
    if (process.env.MONGODB_URI && body.userId) {
      try {
        await connectMongo();
        await UserModel.updateOne(
          { id: body.userId },
          {
            $setOnInsert: {
              id: body.userId,
              balance: 0,
            },
            ...(body.payerEmail ? { $set: { email: body.payerEmail } } : {}),
          },
          { upsert: true },
        );

        await DepositModel.updateOne(
          { depositId: body.depositId },
          {
            $setOnInsert: {
              depositId: body.depositId,
              userId: body.userId,
              amount: body.amount,
              status: "pending",
            },
          },
          { upsert: true },
        );
      } catch (e) {
        console.warn("[mp/preference] mongo write skipped", e);
      }
    }

    const client = new MercadoPagoConfig({ accessToken: token });
    const preference = new Preference(client);

    const prefBodyBase = {
      items: [
        {
          id: `deposit-${body.depositId}`,
          title: "Carga de saldo",
          quantity: 1,
          currency_id: "ARS",
          unit_price: body.amount,
        },
      ],
      external_reference: body.depositId,
      metadata: {
        depositId: body.depositId,
        kind: "deposit",
        userId: body.userId,
        amount: body.amount,
      },
      ...(body.payerEmail
        ? {
            payer: {
              email: body.payerEmail,
            },
          }
        : {}),
      // Webhook (opcional): podés setearlo si querés procesar por server
      notification_url: notificationUrl,
      // En algunos entornos MP valida estas URLs con distintas claves.
      // Para máxima compatibilidad, enviamos ambas convenciones.
      back_urls: backUrls,
      redirect_urls: backUrls,
      back_url: backUrls,
      binary_mode: true,
    };

    const createWithAutoReturn = async () =>
      preference.create({
        body: {
          ...prefBodyBase,
          auto_return: "approved",
        },
      });

    const createWithoutAutoReturn = async () =>
      preference.create({
        body: {
          ...prefBodyBase,
          auto_return: "approved",
        },
      });

    let created:
      | Awaited<ReturnType<typeof createWithAutoReturn>>
      | Awaited<ReturnType<typeof createWithoutAutoReturn>>;
    try {
      // Lo intentamos siempre (como pediste)
      created = await createWithAutoReturn();
    } catch (e) {
      // Si MP no lo permite (por ejemplo localhost), reintentamos sin auto_return.
      const msg = typeof e === "object" && e ? JSON.stringify(e) : String(e);
      if (msg.includes("invalid_auto_return")) {
        created = await createWithoutAutoReturn();
      } else {
        throw e;
      }
    }

    const initPoint =
      (created as unknown as { sandbox_init_point?: string }).sandbox_init_point ??
      (created as unknown as { init_point?: string }).init_point;

    if (!initPoint) {
      return new NextResponse("No se obtuvo init_point", { status: 500 });
    }

    return NextResponse.json({ init_point: initPoint });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return new NextResponse(e.message, { status: 400 });
    }

    console.error("[mp/preference] error", e);
    const msg =
      e instanceof Error
        ? e.message
        : typeof e === "string"
          ? e
          : JSON.stringify(e);
    return new NextResponse(msg, {
      status: 500,
    });
  }
}
