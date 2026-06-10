import { NextResponse } from "next/server";
import { connectMongo } from "../../../lib/mongodb";
import { SessionModel } from "../../../lib/models/Session";
import { CartonPurchaseModel } from "../../../lib/models/CartonPurchase";

export const runtime = "nodejs";

const BACKEND_BASE_URL = "https://admin.vedo.com.ar";

const DEFAULT_HEADERS = {
  accept: "application/json",
  "user-agent": "Mozilla/5.0 (compatible; ProdeBot/1.0; +https://example.com)",
} as const;

function getCookie(req: Request, name: string) {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1];
}

function normalizePick(v: unknown): "1" | "X" | "2" | null {
  const s = String(v ?? "").toUpperCase();
  if (s === "1") return "1";
  if (s === "X" || s === "0") return "X";
  if (s === "2") return "2";
  return null;
}

function normalizeBackendResult(v: unknown): "1" | "X" | "2" | null {
  // Backend suele devolver: local | draw | visit
  // También soportamos 1/X/2 por las dudas.
  const s = String(v ?? "").toLowerCase();
  if (s === "local" || s === "home" || s === "1") return "1";
  if (s === "draw" || s === "x" || s === "0") return "X";
  if (s === "visit" || s === "away" || s === "2") return "2";
  return null;
}

type BackendCartonMatch = {
  index?: number;
  has_result?: boolean;
  result?: unknown;
};

async function fetchBackendMatches(cartonId: number) {
  const res = await fetch(
    `${BACKEND_BASE_URL}/api/prodes/cartones/matchs?carton_id=${encodeURIComponent(String(cartonId))}`,
    { cache: "no-store", redirect: "follow", headers: DEFAULT_HEADERS },
  );

  const text = await res.text();
  if (!res.ok) {
    // Cloudflare challenge en server-to-server (Vercel) suele devolver HTML "Just a moment".
    // En ese caso no tiramos error: devolvemos [] y dejamos que la UI muestre stats básicos.
    if (res.status === 403 && text.toLowerCase().includes("just a moment")) {
      console.warn("[api/carton/purchases] Cloudflare blocked backend matches; returning empty", {
        cartonId,
      });
      return [];
    }
    throw new Error(
      `Error backend /api/prodes/cartones/matchs (${res.status}): ${text?.slice(0, 200) ?? ""}`,
    );
  }
  const json = JSON.parse(text) as { data?: BackendCartonMatch[] };
  return Array.isArray(json.data) ? json.data : [];
}

// (helper reservado para futuro)

export async function GET(req: Request) {
  try {
    if (!process.env.MONGODB_URI) {
      return new NextResponse("MONGODB_URI no configurado", { status: 500 });
    }

    const token = getCookie(req, "prode_session");
    if (!token) return new NextResponse("No autorizado", { status: 401 });

    await connectMongo();

    const session = await SessionModel.findOne({ token }).lean();
    if (!session) return new NextResponse("No autorizado", { status: 401 });
    if (session.expiresAt.getTime() <= Date.now()) {
      await SessionModel.deleteOne({ token });
      return new NextResponse("No autorizado", { status: 401 });
    }

    const url = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));

    const purchases = await CartonPurchaseModel.find({ userId: session.userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const enriched = await Promise.all(
      purchases.map(async (p) => {
        const picksRaw = Array.isArray(p.picks) ? p.picks : [];
        const picks = picksRaw
          .map((pk) => {
            const matchId = Number(pk.matchId);
            const pick = normalizePick(pk.pick);
            if (!Number.isFinite(matchId) || !pick) return null;
            return { matchId, pick } as const;
          })
          .filter(Boolean) as { matchId: number; pick: "1" | "X" | "2" }[];

        const pickMap = new Map<number, "1" | "X" | "2">();
        for (const pk of picks) pickMap.set(pk.matchId, pk.pick);

        // Aciertos = partidos acertados cuyo resultado NO fue empate (1 o 2)
        // Empates = pronóstico X acertado (resultado draw)
        let aciertos = 0;
        let empates = 0;
        let fallos = 0;
        let pendientes = 0;
        let backendFailed = false;

        if (typeof p.cartonId === "number") {
          try {
            const backendMatches = await fetchBackendMatches(p.cartonId);

            // Si el backend quedó bloqueado (Cloudflare) devolvimos [] y no podemos afirmar nada.
            // Marcamos failure para que el front NO muestre FINALIZADO/PERDEDOR incorrecto.
            if (backendMatches.length === 0) {
              backendFailed = true;
            }

            for (const m of backendMatches) {
              const matchId = Number(m.index ?? -1) + 1; // backend index 0-based
              const result = normalizeBackendResult(m.result);
              const hasResult = Boolean(m.has_result) || result != null;
              if (!hasResult) {
                pendientes++;
                continue;
              }
              const userPick = pickMap.get(matchId) ?? null;

              if (userPick && result && userPick === result) {
                if (result === "X") empates++;
                else aciertos++;
              } else {
                fallos++;
              }
            }
          } catch {
            // si falla el backend, devolvemos stats básicos
            backendFailed = true;
          }
        }

        const matchesCount = Array.isArray(p.matches) ? p.matches.length : 0;
        const picksCount = picks.length;

        const isExpired = p.purchaseDeadline ? new Date(p.purchaseDeadline).getTime() <= Date.now() : false;

        // Si no pudimos consultar backend, NO podemos determinar status/outcome.
        // Mostramos EN_JUEGO y outcome null para no inducir a error.
        const status = backendFailed ? "EN_JUEGO" : pendientes > 0 && !isExpired ? "EN_JUEGO" : "FINALIZADO";

        // Regla de "ganador": 80% o más de aciertos sobre la cantidad de partidos del cartón.
        // - Con 15 partidos: 12 (como lo teníamos antes)
        // - Con 30 partidos: 24
        // - Con cartones chicos (ej 1 partido): 1 => si acertás todo, sos ganador.
        const baseCount = matchesCount > 0 ? matchesCount : aciertos + empates + fallos + pendientes;
        const requiredToWin = Math.max(1, Math.ceil(baseCount * 0.8));
        const totalCorrect = aciertos + empates;
        const outcome = status === "FINALIZADO" ? (totalCorrect >= requiredToWin ? "GANADOR" : "PERDEDOR") : null;

        return {
          purchaseId: p.purchaseId,
          cartonId: p.cartonId ?? null,
          cartonTitle: p.cartonTitle ?? null,
          numberDate: p.numberDate ?? null,
          kind: p.kind,
          price: p.price,
          createdAt: p.createdAt,
          purchaseDeadline: p.purchaseDeadline ?? null,
          picks,
          stats: {
            matchesCount,
            picksCount,
            aciertos,
            empates,
            fallos,
            pendientes,
            status,
            outcome,
            backendFailed,
          },
        };
      }),
    );

    return NextResponse.json({ ok: true, data: enriched });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Error" },
      { status: 500 },
    );
  }
}
