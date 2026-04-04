export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL || process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY || process.env.OPENAI_API_KEY || "",
  customLlmApiUrl: process.env.CUSTOM_LLM_API_URL ?? "",
  customLlmApiKey: process.env.CUSTOM_LLM_API_KEY ?? "",
  customLlmModel: process.env.CUSTOM_LLM_MODEL ?? "gpt-5.4",
  twelveDataApiKey: process.env.TWELVE_DATA_API_KEY ?? "",
};

// Production environment variable validation
if (ENV.isProduction) {
  const required: Array<[string, string]> = [
    ["DATABASE_URL", ENV.databaseUrl],
    ["JWT_SECRET", ENV.cookieSecret],
  ];
  const missing = required.filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    console.error(
      `[ENV] FATAL: Missing required environment variables in production: ${missing.join(", ")}`
    );
    process.exit(1);
  }

  const recommended: Array<[string, string]> = [
    ["TWELVE_DATA_API_KEY", ENV.twelveDataApiKey],
    ["CUSTOM_LLM_API_URL", ENV.customLlmApiUrl],
    ["CUSTOM_LLM_API_KEY", ENV.customLlmApiKey],
  ];
  const missingRecommended = recommended.filter(([, v]) => !v).map(([k]) => k);
  if (missingRecommended.length > 0) {
    console.warn(
      `[ENV] Warning: Recommended environment variables not set: ${missingRecommended.join(", ")}`
    );
  }
}
