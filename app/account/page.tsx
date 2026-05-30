"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import {
  getBetsForUser,
  getMatchById,
  settleExpiredMatches,
} from "../lib/localdb";
import { useSessionUser } from "../lib/useSessionUser";

export default function AccountPage() {
  const { user, refresh } = useSessionUser();
  const [, setTick] = useState(0);

  useEffect(() => {
    settleExpiredMatches();
    refresh();
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [refresh]);

  const bets = useMemo(() => (user ? getBetsForUser(user.id) : []), [user]);
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Cuenta</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {user.name} · {user.email} · Saldo:{" "}
          <span className="font-medium">${user.balance}</span>
        </p>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Mis apuestas</div>
            <div className="text-xs text-zinc-500">
              Se actualiza solo al vencer el timer.
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              settleExpiredMatches();
              refresh();
            }}
          >
            Actualizar
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {bets.length === 0 ? (
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Aún no tenés apuestas.
            </div>
          ) : (
            bets.map((b) => {
              const m = getMatchById(b.matchId);
              return (
                <div
                  key={b.id}
                  className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-medium">
                      {m ? `${m.teams[0]} vs ${m.teams[1]}` : b.matchId}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {new Date(b.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="text-zinc-600 dark:text-zinc-400">
                      Elegiste: <span className="font-medium">{b.pick}</span> · Monto:{" "}
                      <span className="font-medium">${b.amount}</span>
                    </div>
                    <div
                      className={`text-xs font-medium ${
                        b.status === "won"
                          ? "text-emerald-600"
                          : b.status === "lost"
                            ? "text-rose-600"
                            : "text-zinc-500"
                      }`}
                    >
                      {b.status === "pending"
                        ? "Pendiente"
                        : b.status === "won"
                          ? `Ganada (+$${b.payout ?? 0})`
                          : "Perdida"}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
