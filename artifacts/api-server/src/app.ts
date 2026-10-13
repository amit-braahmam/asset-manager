import express, { type Express, type Request, type Response, type NextFunction } from "express";
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
import { corsAllowsRequest } from "./lib/cors";
import { apiRateLimit } from "./lib/rate-limit";
import { warrantyCronHandler, custodyCronHandler } from "./routes/cron";
import publicCustodyRouter from "./routes/custody-public";

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
      callback(null, corsAllowsRequest(origin));
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
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true, limit: "8mb" }));

app.get("/healthz", (_req, res) => {
  res.json(HealthCheckResponse.parse({ status: "ok" }));
});
app.get("/api/healthz", (_req, res) => {
  res.json(HealthCheckResponse.parse({ status: "ok" }));
});
app.get("/api/internal/cron/warranty", warrantyCronHandler);
app.post("/api/internal/cron/warranty", warrantyCronHandler);
app.get("/api/internal/cron/custody", custodyCronHandler);
app.post("/api/internal/cron/custody", custodyCronHandler);

app.use("/api/public", publicCustodyRouter);
app.use("/api", apiRateLimit, attachAppUser, router);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "unhandled request error");
  if (res.headersSent) return;
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

export default app;
