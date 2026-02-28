import { createApp } from "./app";
import { env } from "./config/env";
import { ensureContainer } from "./services/blob";
import { startWorker } from "./worker/worker";

async function main(): Promise<void> {
  await ensureContainer();
  startWorker();

  const app = createApp();
  app.listen(env.port, () => {
    process.stdout.write(`backend listening on http://localhost:${env.port}\n`);
  });
}

void main();

