import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BACKEND_BASE_URL = "https://admin.vedo.com.ar";

const DEFAULT_HEADERS = {
  accept: "application/json",
  "user-agent": "Mozilla/5.0 (compatible; ProdeBot/1.0; +https://example.com)",
} as const;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const qs = new URLSearchParams();

    // Forward de filtros opcionales
    for (const key of [
      "carton_id",
      "number_date",
      "q",
      "has_result",
      "is_closed",
      "sort",
    ] as const) {
      const v = url.searchParams.get(key);
      if (v) qs.set(key, v);
    }

    const backendUrl = `${BACKEND_BASE_URL}/api/prodes/cartones/matchs${qs.size ? `?${qs}` : ""}`;

    const res = await fetch(backendUrl, {
      cache: "no-store",
      redirect: "follow",
      headers: DEFAULT_HEADERS,
    });

    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: "Error consultando backend /api/prodes/cartones/matchs",
          status: res.status,
          body: text?.slice(0, 500) ?? "",
        },
        { status: 502 },
      );
    }

    try {
      const json = JSON.parse(text) as unknown;
      return NextResponse.json(json, { status: 200 });
    } catch {
      return NextResponse.json(
        {
          ok: false,
          message: "Respuesta inválida (no JSON) desde backend /api/prodes/cartones/matchs",
          body: text?.slice(0, 500) ?? "",
        },
        { status: 502 },
      );
    }
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Error" },
      { status: 500 },
    );
  }
}
