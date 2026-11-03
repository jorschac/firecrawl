import { NextFunction, Request, Response } from "express";
import { RateLimiterRedis, RateLimiterRes } from "rate-limiter-flexible";
import { config } from "../config";
import { isSelfHosted } from "../lib/deployment";
import { logger } from "../lib/logger";
import { redisRateLimitClient } from "./rate-limiter";

const LIMITER_KEY = "scrape-search-map";

let limiter: RateLimiterRedis | null = null;

function getLimiter(): RateLimiterRedis {
  if (!limiter) {
    limiter = new RateLimiterRedis({
      storeClient: redisRateLimitClient,
      keyPrefix: "selfhosted_ssm",
      points: config.SELF_HOSTED_RATE_LIMIT_POINTS,
      duration: config.SELF_HOSTED_RATE_LIMIT_DURATION,
    });
  }
  return limiter;
}

export function formatSelfHostedRateLimitError(
  retryAfterSeconds: number,
): string {
  const points = config.SELF_HOSTED_RATE_LIMIT_POINTS;
  const duration = config.SELF_HOSTED_RATE_LIMIT_DURATION;
  return `自托管限流：scrape、search、map 合计每 ${duration} 秒最多 ${points} 次。请在 ${retryAfterSeconds} 秒后再试。`;
}

export const selfHostedRateLimit = {
  consume: () => getLimiter().consume(LIMITER_KEY, 1),
};

function isRateLimiterRes(err: unknown): err is RateLimiterRes {
  return err instanceof RateLimiterRes;
}

export async function selfHostedScrapeSearchMapRateLimit(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!isSelfHosted()) {
    next();
    return;
  }

  try {
    await selfHostedRateLimit.consume();
    next();
  } catch (err) {
    if (isRateLimiterRes(err)) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(err.msBeforeNext / 1000),
      );
      const error = formatSelfHostedRateLimitError(retryAfterSeconds);
      logger.warn("Self-hosted scrape/search/map rate limit exceeded", {
        retryAfterSeconds,
        points: config.SELF_HOSTED_RATE_LIMIT_POINTS,
        duration: config.SELF_HOSTED_RATE_LIMIT_DURATION,
      });
      res.set("Retry-After", String(retryAfterSeconds));
      res.status(429).json({
        success: false,
        code: "RATE_LIMIT_EXCEEDED",
        error,
      });
      return;
    }

    logger.warn("Self-hosted rate limiter failed open", { err });
    next();
  }
}
