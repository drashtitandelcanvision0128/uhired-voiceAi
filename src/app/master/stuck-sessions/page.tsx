"use client";

import { MasterShell } from "@/components/master-shell";
import { MasterStuckSessionsPanel } from "@/components/master-stuck-sessions";

export default function MasterStuckSessionsPage() {
  return (
    <MasterShell title="Stuck interviews" subtitle="Live or waiting for more than 1 hour.">
      <MasterStuckSessionsPanel defaultPageSize={10} hideWhenEmpty={false} />
    </MasterShell>
  );
}
