import { NextResponse } from "next/server";
import MercadoPagoConfig, { Payment } from "mercadopago";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) {
      return new NextResponse("MP_ACCESS_TOKEN no configurado", { status: 500 });
    }

    const { id } = await params;
    if (!id) return new NextResponse("id requerido", { status: 400 });

    const client = new MercadoPagoConfig({ accessToken: token });
    const payment = new Payment(client);
    const info = await payment.get({ id });

    return NextResponse.json({
      id: String(info.id ?? id),
      status: info.status,
      transaction_amount: info.transaction_amount,
      external_reference: info.external_reference,
      metadata: info.metadata,
    });
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : "Error", {
      status: 500,
    });
  }
}
