import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: Number(optional("PORT", "3001")),
  nodeEnv: optional("NODE_ENV", "development"),
  appUrl: optional("APP_URL", "http://localhost:5173"),
  apiUrl: optional("API_URL", "http://localhost:3001"),
  sessionSecret: required("SESSION_SECRET"),
  registrationCode: required("REGISTRATION_CODE"),
  databaseUrl: required("DATABASE_URL"),
  isDev: optional("NODE_ENV", "development") !== "production",
  google: {
    clientId: required("GOOGLE_CLIENT_ID"),
    clientSecret: required("GOOGLE_CLIENT_SECRET"),
    redirectUri: required("GOOGLE_REDIRECT_URI"),
  },
  microsoft: {
    clientId: required("MICROSOFT_CLIENT_ID"),
    clientSecret: required("MICROSOFT_CLIENT_SECRET"),
    tenantId: optional("MICROSOFT_TENANT_ID", "common"),
    redirectUri: required("MICROSOFT_REDIRECT_URI"),
  },
} as const;
