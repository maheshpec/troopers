import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

/**
 * Process entrypoint. 12-factor: config from env (III), listens on $PORT (VII),
 * logs to stdout (XI), and shuts down gracefully on SIGTERM (IX disposability).
 */
async function main() {
  const config = loadConfig();
  const { app } = await buildApp(config);

  const close = async (signal: string) => {
    app.log.info({ signal }, "shutting down");
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void close("SIGTERM"));
  process.on("SIGINT", () => void close("SIGINT"));

  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
  } catch (err) {
    app.log.error({ err }, "failed to start");
    process.exit(1);
  }
}

void main();
