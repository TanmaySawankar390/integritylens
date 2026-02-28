import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  jwtSecret: required("JWT_SECRET"),
  sqlServer: required("AZURE_SQL_SERVER"),
  sqlDatabase: required("AZURE_SQL_DATABASE"),
  sqlUser: required("AZURE_SQL_USER"),
  sqlPassword: required("AZURE_SQL_PASSWORD"),
  sqlEncrypt: (process.env.AZURE_SQL_ENCRYPT ?? "true") === "true",
  blobConnectionString: required("AZURE_STORAGE_CONNECTION_STRING"),
  blobContainer: process.env.AZURE_STORAGE_CONTAINER ?? "shikshamitra",
  diEndpoint: required("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT"),
  diKey: required("AZURE_DOCUMENT_INTELLIGENCE_KEY"),
  useAzureOpenAI: (process.env.USE_AZURE_OPENAI ?? "true") === "true",

  openaiEndpoint: process.env.AZURE_OPENAI_ENDPOINT ?? "",
  openaiApiKey: process.env.AZURE_OPENAI_API_KEY ?? "",
  openaiDeployment: process.env.AZURE_OPENAI_DEPLOYMENT ?? "",
  openaiModel: process.env.AZURE_OPENAI_MODEL ?? "gpt-4o-mini",

  openaiDevApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiDevModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  translatorEndpoint: process.env.AZURE_TRANSLATOR_ENDPOINT,
  translatorKey: process.env.AZURE_TRANSLATOR_KEY,
  translatorRegion: process.env.AZURE_TRANSLATOR_REGION
};
