import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function contactApiPlugin() {
  const registerMiddleware = (middlewares) => {
    middlewares.use(async (req, res, next) => {
      const requestPath = req.url?.split("?")[0];
      if (requestPath !== "/api/contact") {
        next();
        return;
      }

      try {
        const rawBody = await new Promise((resolve, reject) => {
          let body = "";

          req.on("data", (chunk) => {
            body += chunk;
          });

          req.on("end", () => {
            resolve(body);
          });

          req.on("error", reject);
        });

        req.body = rawBody ? JSON.parse(rawBody) : {};
      } catch (error) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "Invalid JSON payload." }));
        return;
      }

      res.status = function status(code) {
        this.statusCode = code;
        return this;
      };

      res.json = function json(payload) {
        if (!this.headersSent) {
          this.setHeader("Content-Type", "application/json; charset=utf-8");
        }

        this.end(JSON.stringify(payload));
        return this;
      };

      const { default: handleContact } = await import("./api/contact.js");
      await handleContact(req, res);
    });
  };

  return {
    name: "local-contact-api",
    configureServer(server) {
      registerMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      registerMiddleware(server.middlewares);
    },
  };
}

export default defineConfig({
  plugins: [react(), contactApiPlugin()],
});
