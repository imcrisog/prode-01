"use client";

import Link from "next/link";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";

export default function MpFailurePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Depósito</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          No se pudo completar el pago.
        </p>
      </div>

      <Card>
        <div className="space-y-3">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Podés volver a intentar desde la billetera.
          </div>
          <Button asChild>
            <Link href="/wallet">Ir a billetera</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
