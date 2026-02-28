import { AzureKeyCredential, DocumentAnalysisClient } from "@azure/ai-form-recognizer";
import { env } from "../config/env";

const client = new DocumentAnalysisClient(
  env.diEndpoint,
  new AzureKeyCredential(env.diKey)
);

export async function analyzeLayout(
  buffer: Buffer,
  contentType?: string
): Promise<unknown> {
  void contentType;
  const poller = await client.beginAnalyzeDocument("prebuilt-layout", buffer);
  const result = await poller.pollUntilDone();
  return result;
}
