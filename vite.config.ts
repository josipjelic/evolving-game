import { defineConfig, type Plugin } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Dev-only: POST /api/telemetry saves human play sessions to telemetry/sessions/ */
function telemetryPlugin(): Plugin {
  const sessionsDir = join(import.meta.dirname, "telemetry", "sessions");

  return {
    name: "telemetry-ingest",
    configureServer(server) {
      server.middlewares.use("/api/telemetry", (req, res, next) => {
        if (req.method !== "POST") return next();

        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", () => {
          try {
            const session = JSON.parse(body);
            mkdirSync(sessionsDir, { recursive: true });
            const id = session.sessionId ?? `session-${Date.now()}`;
            const file = `${id}.json`;
            writeFileSync(join(sessionsDir, file), JSON.stringify(session, null, 2));
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, file }));
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: "invalid json" }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  root: "src",
  publicDir: "../public",
  plugins: [telemetryPlugin()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  server: {
    fs: { allow: [".."] },
  },
});
