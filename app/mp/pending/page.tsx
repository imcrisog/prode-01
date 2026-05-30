"use client";

import Link from "next/link";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";

export default function MpPendingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Depósito</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Tu pago quedó pendiente.
        </p>
      </div>

      <Card>
        <div className="space-y-3">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Cuando se apruebe, volvé a la billetera para acreditar.
          </div>
          <Button variant="secondary" asChild>
            <Link href="/wallet">Ir a billetera</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
