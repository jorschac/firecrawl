import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("undici", async importOriginal => ({
  ...(await importOriginal<typeof import("undici")>()),
  fetch: fetchMock,
}));

vi.mock("../../scraper/scrapeURL/engines/utils/safeFetch", () => ({
  getSecureDispatcher: vi.fn(() => undefined),
}));

vi.mock("../../config", () => ({
  config: { BRAVE_SEARCH_API_KEY: "test-key" },
}));

vi.mock("../../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { braveSearch } from "./bravesearch";

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function page(urls: string[], moreResultsAvailable: boolean) {
  return jsonResponse(200, {
    query: { more_results_available: moreResultsAvailable },
    web: {
      results: urls.map(url => ({
        url,
        title: `title ${url}`,
        description: `description ${url}`,
      })),
    },
  });
}

function requestedUrl(call: number): URL {
  return new URL(fetchMock.mock.calls[call][0] as string);
}

describe("braveSearch", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("maps Brave web results and authenticates with the subscription token", async () => {
    fetchMock.mockResolvedValueOnce(
      page(["https://a.test/", "https://b.test/"], false),
    );

    const res = await braveSearch("firecrawl", 5, {
      lang: "en",
      country: "us",
      tbs: "qdr:w",
      safe: true,
    });

    expect(res.web).toEqual([
      {
        url: "https://a.test/",
        title: "title https://a.test/",
        description: "description https://a.test/",
      },
      {
        url: "https://b.test/",
        title: "title https://b.test/",
        description: "description https://b.test/",
      },
    ]);

    const url = requestedUrl(0);
    expect(url.origin + url.pathname).toBe(
      "https://api.search.brave.com/res/v1/web/search",
    );
    expect(url.searchParams.get("q")).toBe("firecrawl");
    expect(url.searchParams.get("count")).toBe("5");
    expect(url.searchParams.get("offset")).toBe("0");
    expect(url.searchParams.get("country")).toBe("US");
    expect(url.searchParams.get("search_lang")).toBe("en");
    expect(url.searchParams.get("freshness")).toBe("pw");
    expect(url.searchParams.get("safesearch")).toBe("strict");
    expect(url.searchParams.get("text_decorations")).toBe("false");

    const init = fetchMock.mock.calls[0][1] as {
      headers: Record<string, string>;
    };
    expect(init.headers["X-Subscription-Token"]).toBe("test-key");
  });

  it("maps Chinese, unsupported countries and custom date ranges to Brave values", async () => {
    fetchMock.mockResolvedValueOnce(page(["https://a.test/"], false));

    await braveSearch("北京天气", 5, {
      lang: "zh",
      country: "sg",
      tbs: "cdr:1,cd_min:1/2/2024,cd_max:3/4/2024",
    });

    const url = requestedUrl(0);
    expect(url.searchParams.get("search_lang")).toBe("zh-hans");
    expect(url.searchParams.get("country")).toBe("ALL");
    expect(url.searchParams.get("freshness")).toBe("2024-01-02to2024-03-04");
    expect(url.searchParams.has("safesearch")).toBe(false);
  });

  it("pages with offset until it has enough unique results", async () => {
    fetchMock
      .mockResolvedValueOnce(page(["https://a.test/", "https://b.test/"], true))
      .mockResolvedValueOnce(
        page(["https://b.test/", "https://c.test/"], true),
      );

    const res = await braveSearch("firecrawl", 3);

    expect(res.web?.map(r => r.url)).toEqual([
      "https://a.test/",
      "https://b.test/",
      "https://c.test/",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestedUrl(0).searchParams.get("count")).toBe("3");
    expect(requestedUrl(1).searchParams.get("offset")).toBe("1");
  });

  it("decodes HTML entities in titles and descriptions", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        query: { more_results_available: false },
        web: {
          results: [
            {
              url: "https://x.test/",
              title: "Tom &amp; Jerry",
              description: "we&#x27;re taking over",
            },
          ],
        },
      }),
    );

    const res = await braveSearch("firecrawl", 5);

    expect(res.web?.[0].title).toBe("Tom & Jerry");
    expect(res.web?.[0].description).toBe("we're taking over");
  });

  it("stops paging when Brave reports no more results", async () => {
    fetchMock.mockResolvedValueOnce(page(["https://a.test/"], false));

    const res = await braveSearch("firecrawl", 10);

    expect(res.web).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns an empty response when Brave has no web results", async () => {
    fetchMock.mockResolvedValueOnce(page([], false));

    await expect(braveSearch("nothing", 5)).resolves.toEqual({});
  });

  it("throws with Brave's error code when the token is rejected", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, {
        error: {
          code: "SUBSCRIPTION_TOKEN_INVALID",
          detail: "The provided subscription token is invalid.",
        },
      }),
    );

    await expect(braveSearch("firecrawl", 5)).rejects.toThrow(
      "HTTP 422 SUBSCRIPTION_TOKEN_INVALID",
    );
  });

  it("throws when Brave rate limits the request", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(429, { error: { code: "RATE_LIMITED" } }),
    );

    await expect(braveSearch("firecrawl", 5)).rejects.toThrow("HTTP 429");
  });
});
