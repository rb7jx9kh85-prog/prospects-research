type ServerEnv = {
  multisourceApiKey: string;
  multisourceApiUrl: string;
  authSecret: string;
  sessionTtlHours: number;
};

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const required = {
    multisourceApiKey: process.env.MULTISOURCE_API_KEY,
    authSecret: process.env.AUTH_SECRET,
  };

  const missing = [
    !required.multisourceApiKey && "MULTISOURCE_API_KEY",
    !required.authSecret && "AUTH_SECRET",
  ].filter((name): name is string => Boolean(name));

  if (missing.length > 0) {
    throw new Error(`Configuration serveur manquante: ${missing.join(", ")}`);
  }

  if (required.authSecret!.length < 32) {
    throw new Error("AUTH_SECRET doit contenir au moins 32 caractères aléatoires.");
  }

  const sessionTtlHours = Number(process.env.SESSION_TTL_HOURS ?? "12");
  if (!Number.isFinite(sessionTtlHours) || sessionTtlHours < 1 || sessionTtlHours > 168) {
    throw new Error("SESSION_TTL_HOURS doit être compris entre 1 et 168.");
  }

  cached = {
    multisourceApiKey: required.multisourceApiKey!,
    multisourceApiUrl: (process.env.MULTISOURCE_API_URL ?? "https://api.multisource.ch/v2").replace(/\/$/, ""),
    authSecret: required.authSecret!,
    sessionTtlHours,
  };

  return cached;
}
