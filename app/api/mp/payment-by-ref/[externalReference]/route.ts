import { NextResponse } from "next/server";
import MercadoPagoConfig, { Payment } from "mercadopago";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ externalReference: string }> },
) {
  try {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) {
      return new NextResponse("MP_ACCESS_TOKEN no configurado", { status: 500 });
    }

    const { externalReference } = await params;
    if (!externalReference) {
      return new NextResponse("externalReference requerido", { status: 400 });
    }

    const client = new MercadoPagoConfig({ accessToken: token });
    const payment = new Payment(client);

    const search = await payment.search({
      options: {
        external_reference: externalReference,
        sort: "date_created",
        criteria: "desc",
      },
    });

    const first = search.results?.[0];
    if (!first?.id) {
      return new NextResponse("No se encontró pago para external_reference", {
        status: 404,
      });
    }

    return NextResponse.json({
      id: String(first.id),
      status: first.status,
      transaction_amount: first.transaction_amount,
      external_reference: first.external_reference,
      metadata: first.metadata,
    });
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : "Error", {
      status: 500,
    });
  }
}
