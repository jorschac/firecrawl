import type { NextFunction, Request, Response } from "express";
import { RateLimiterRes } from "rate-limiter-flexible";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/deployment", () => ({
  isSelfHosted: vi.fn(() => true),
}));

vi.mock("./rate-limiter", () => ({
  redisRateLimitClient: {},
}));

import { isSelfHosted } from "../lib/deployment";
import {
  formatSelfHostedRateLimitError,
  selfHostedRateLimit,
  selfHostedScrapeSearchMapRateLimit,
} from "./self-hosted-rate-limit";

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    set: vi.fn((key: string, value: string) => {
      res.headers[key] = value;
      return res;
    }),
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn((body: unknown) => {
      res.body = body;
      return res;
    }),
  };
  return res as unknown as Response & {
    statusCode: number;
    body: unknown;
    headers: Record<string, string>;
  };
}

describe("self-hosted scrape/search/map rate limit", () => {
  beforeEach(() => {
    vi.mocked(isSelfHosted).mockReturnValue(true);
  });

  it("describes the 50-per-60s rule in the error text", () => {
    expect(formatSelfHostedRateLimitError(12)).toContain("每 60 秒最多 50 次");
    expect(formatSelfHostedRateLimitError(12)).toContain("12 秒后再试");
  });

  it("allows the request when under the cap", async () => {
    const consume = vi
      .spyOn(selfHostedRateLimit, "consume")
      .mockResolvedValue({} as never);
    const next = vi.fn() as NextFunction;
    const res = mockRes();

    await selfHostedScrapeSearchMapRateLimit({} as Request, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.json).not.toHaveBeenCalled();
    consume.mockRestore();
  });

  it("returns 429 with the limit rule when the cap is exceeded", async () => {
    const consume = vi
      .spyOn(selfHostedRateLimit, "consume")
      .mockRejectedValue(new RateLimiterRes(0, 15_000, 10, false));
    const next = vi.fn() as NextFunction;
    const res = mockRes();

    await selfHostedScrapeSearchMapRateLimit({} as Request, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.headers["Retry-After"]).toBe("15");
    expect(res.body).toEqual({
      success: false,
      code: "RATE_LIMIT_EXCEEDED",
      error: formatSelfHostedRateLimitError(15),
    });
    consume.mockRestore();
  });

  it("does not limit hosted (DB auth) deployments", async () => {
    vi.mocked(isSelfHosted).mockReturnValue(false);
    const consume = vi.spyOn(selfHostedRateLimit, "consume");
    const next = vi.fn() as NextFunction;
    const res = mockRes();

    await selfHostedScrapeSearchMapRateLimit({} as Request, res, next);

    expect(consume).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
    consume.mockRestore();
  });
});
