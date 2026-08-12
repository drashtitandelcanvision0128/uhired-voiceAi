export type AppEnvironment = "development" | "staging" | "production";

export function getAppEnvironment(): AppEnvironment {
  const explicit = process.env.APP_ENV?.trim().toLowerCase();
  if (explicit === "staging" || explicit === "production" || explicit === "development") {
    return explicit;
  }

  if (process.env.VERCEL_ENV === "production") return "production";
  if (process.env.VERCEL_ENV === "preview") return "staging";
  if (process.env.NODE_ENV === "production") return "production";
  return "development";
}

export function getAppEnvironmentLabel(environment: AppEnvironment = getAppEnvironment()) {
  if (environment === "production") return "Production";
  if (environment === "staging") return "Staging";
  return "Development";
}

export function getAppEnvironmentBadgeClass(environment: AppEnvironment = getAppEnvironment()) {
  if (environment === "production") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (environment === "staging") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-sky-200 bg-sky-50 text-sky-800";
}
