"use client";

import { MasterShell } from "@/components/master-shell";
import { MasterStuckSessionsPanel } from "@/components/master-stuck-sessions";

export default function MasterStuckSessionsPage() {
  return (
    <MasterShell
      title="Stuck Interviews"
      subtitle="Interviews stuck in LIVE or READY for more than 1 hour — review and resolve them here."
    >
      <MasterStuckSessionsPanel defaultPageSize={10} hideWhenEmpty={false} />
    </MasterShell>
  );
}
