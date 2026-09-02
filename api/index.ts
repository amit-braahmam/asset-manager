import express from "express";
import app from "../artifacts/api-server/src/app";

/**
 * Vercel serves this as a single Function. Rewrites send `/api/*` here.
 * Keep Express routes at `/api/...` whether Vercel preserves that prefix or not.
 */
const handler = express();
handler.use((req, _res, next) => {
  const url = req.url || "/";
  if (url === "/healthz" || url.startsWith("/healthz?") || url.startsWith("/api/") || url === "/api") {
    next();
    return;
  }
  req.url = `/api${url.startsWith("/") ? url : `/${url}`}`;
  next();
});
handler.use(app);

export default handler;
