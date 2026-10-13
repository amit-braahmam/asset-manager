import type { Request, Response, NextFunction, RequestHandler } from "express";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { logger } from "./logger";

type Bucket = { count: number; resetAt: number };

const memory = new Map<string, Bucket>();

function memoryLimit(key: string, limit: number, windowMs: number): { ok: boolean; remaining: number } {
  const now = Date.now();
  const current = memory.get(key);
  if (!current || current.resetAt < now) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  current.count += 1;
  if (current.count > limit) return { ok: false, remaining: 0 };
  return { ok: true, remaining: Math.max(0, limit - current.count) };
}

function redisConfigured() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

const limiters = new Map<string, Ratelimit>();

function upstashLimiter(name: string, limit: number, window: `${number} s` | `${number} m`): Ratelimit {
  const existing = limiters.get(name);
  if (existing) return existing;
  const limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix: `assetcontrol:${name}`,
    analytics: false,
  });
  limiters.set(name, limiter);
  return limiter;
}

export function createRateLimit(options: {
  name: string;
  limit: number;
  windowMs: number;
  windowLabel: `${number} s` | `${number} m`;
}): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${options.name}:${ip}`;
    try {
      if (redisConfigured()) {
        const result = await upstashLimiter(options.name, options.limit, options.windowLabel).limit(key);
        res.setHeader("X-RateLimit-Limit", String(options.limit));
        res.setHeader("X-RateLimit-Remaining", String(result.remaining));
        if (!result.success) {
          res.status(429).json({ error: "Too many requests. Try again shortly." });
          return;
        }
        next();
        return;
      }
      const result = memoryLimit(key, options.limit, options.windowMs);
      res.setHeader("X-RateLimit-Limit", String(options.limit));
      res.setHeader("X-RateLimit-Remaining", String(result.remaining));
      if (!result.ok) {
        res.status(429).json({ error: "Too many requests. Try again shortly." });
        return;
      }
      next();
    } catch (err) {
      logger.warn({ err, name: options.name }, "rate limit check failed; allowing request");
      next();
    }
  };
}

export const publicCustodyRateLimit = createRateLimit({
  name: "public-custody",
  limit: 30,
  windowMs: 60_000,
  windowLabel: "1 m",
});

export const apiRateLimit = createRateLimit({
  name: "api",
  limit: 120,
  windowMs: 60_000,
  windowLabel: "1 m",
});
