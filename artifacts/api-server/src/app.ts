import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { HealthCheckResponse } from "@workspace/api-zod";
import router from "./routes";
import { logger } from "./lib/logger";
import { attachAppUser } from "./lib/auth";

const app: Express = express();

if (process.env.VERCEL) {
  app.use((req, _res, next) => {
    const url = req.url || "/";
    if (
      url === "/healthz" ||
      url.startsWith("/healthz?") ||
      url.startsWith("/api/") ||
      url === "/api"
    ) {
      next();
      return;
    }
    req.url = `/api${url.startsWith("/") ? url : `/${url}`}`;
    next();
  });
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const extra = (process.env.CORS_ORIGIN ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      try {
        const host = new URL(origin).hostname;
        const allowed =
          extra.includes(origin) ||
          host === "localhost" ||
          host === "127.0.0.1" ||
          host.endsWith(".vercel.app");
        callback(null, allowed);
      } catch {
        callback(null, false);
      }
    },
    credentials: true,
  }),
);
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/healthz", (_req, res) => {
  res.json(HealthCheckResponse.parse({ status: "ok" }));
});
app.get("/api/healthz", (_req, res) => {
  res.json(HealthCheckResponse.parse({ status: "ok" }));
});

app.use("/api", attachAppUser, router);

export default app;
