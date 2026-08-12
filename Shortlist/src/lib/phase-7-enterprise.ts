import { env } from "@/lib/env";

/**
 * Phase 7b enterprise features (RBAC guards, SSO, team UI).
 * Set PHASE_7B_ENABLED=true in .env when you are ready to use them.
 */
export function isPhase7bEnabled(): boolean {
  return env.phase7bEnabled;
}
