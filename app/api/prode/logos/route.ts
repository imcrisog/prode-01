import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BACKEND_BASE_URL = "https://admin.vedo.com.ar";

const DEFAULT_HEADERS = {
  accept: "application/json",
  "user-agent": "Mozilla/5.0 (compatible; ProdeBot/1.0; +https://example.com)",
} as const;

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/prode/logos`, {
      cache: "no-store",
      redirect: "follow",
      headers: DEFAULT_HEADERS,
    });

    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: "Error consultando backend /api/prode/logos",
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
          message: "Respuesta inválida (no JSON) desde backend /api/prode/logos",
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
