import * as undici from "undici";
import { decode as decodeHtmlEntities } from "he";
import { config } from "../../config";
import { SearchV2Response, WebSearchResult } from "../../lib/entities";
import { logger } from "../../lib/logger";
import { getSecureDispatcher } from "../../scraper/scrapeURL/engines/utils/safeFetch";

const BRAVE_WEB_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";
const MAX_COUNT = 20;
const MAX_OFFSET = 9;

const SUPPORTED_COUNTRIES = new Set([
  "AR",
  "AU",
  "AT",
  "BE",
  "BR",
  "CA",
  "CL",
  "DK",
  "FI",
  "FR",
  "DE",
  "GR",
  "HK",
  "IN",
  "ID",
  "IT",
  "JP",
  "KR",
  "MY",
  "MX",
  "NL",
  "NZ",
  "NO",
  "CN",
  "PL",
  "PT",
  "PH",
  "RU",
  "SA",
  "ZA",
  "ES",
  "SE",
  "CH",
  "TW",
  "TR",
  "GB",
  "US",
  "ALL",
]);

const SUPPORTED_LANGS = new Set([
  "ar",
  "eu",
  "bn",
  "bg",
  "ca",
  "zh-hans",
  "zh-hant",
  "hr",
  "cs",
  "da",
  "nl",
  "en",
  "en-gb",
  "et",
  "fi",
  "fr",
  "gl",
  "de",
  "el",
  "gu",
  "he",
  "hi",
  "hu",
  "is",
  "it",
  "ja",
  "jp",
  "kn",
  "ko",
  "lv",
  "lt",
  "ms",
  "ml",
  "mr",
  "nb",
  "pl",
  "pt-br",
  "pt-pt",
  "pa",
  "ro",
  "ru",
  "sr",
  "sk",
  "sl",
  "es",
  "sv",
  "ta",
  "te",
  "th",
  "tr",
  "uk",
  "vi",
]);

const LANG_ALIASES: Record<string, string> = {
  zh: "zh-hans",
  "zh-cn": "zh-hans",
  "zh-sg": "zh-hans",
  "zh-tw": "zh-hant",
  "zh-hk": "zh-hant",
  "zh-mo": "zh-hant",
};

const FRESHNESS_BY_UNIT: Record<string, string> = {
  h: "pd",
  d: "pd",
  w: "pw",
  m: "pm",
  y: "py",
};

interface SearchOptions {
  tbs?: string;
  lang?: string;
  country?: string;
  safe?: boolean;
  timeout?: number;
}

interface BraveWebSearchResponse {
  query?: { more_results_available?: boolean };
  web?: {
    results?: { url?: string; title?: string; description?: string }[];
  };
  error?: { code?: string; detail?: string };
}

function toIsoDate(value: string | undefined): string | undefined {
  const match = value?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return undefined;
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

/** Maps Google-style `tbs` (and the DDG forms it already accepted) to Brave `freshness`. */
function tbsToFreshness(tbs: string | undefined): string | undefined {
  const value = tbs?.trim();
  if (!value) return undefined;

  if (
    /^p[dwmy]$/.test(value) ||
    /^\d{4}-\d{2}-\d{2}to\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return value;
  }
  const ddgRange = value.match(/^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/);
  if (ddgRange) return `${ddgRange[1]}to${ddgRange[2]}`;
  if (FRESHNESS_BY_UNIT[value]) return FRESHNESS_BY_UNIT[value];

  const fields = new Map<string, string>();
  for (const part of value.split(",")) {
    const sep = part.indexOf(":");
    if (sep > 0)
      fields.set(part.slice(0, sep).trim(), part.slice(sep + 1).trim());
  }

  const qdrUnit = fields.get("qdr")?.charAt(0);
  if (qdrUnit && FRESHNESS_BY_UNIT[qdrUnit]) return FRESHNESS_BY_UNIT[qdrUnit];

  const from = toIsoDate(fields.get("cd_min"));
  const to = toIsoDate(fields.get("cd_max"));
  if (from && to) return `${from}to${to}`;

  return undefined;
}

function buildParams(
  term: string,
  count: number,
  { tbs, lang, country, safe }: SearchOptions,
): URLSearchParams {
  const params = new URLSearchParams({
    q: term,
    count: String(count),
    result_filter: "web",
    text_decorations: "false",
  });

  if (country) {
    const code = country.toUpperCase() === "UK" ? "GB" : country.toUpperCase();
    params.set("country", SUPPORTED_COUNTRIES.has(code) ? code : "ALL");
  }

  if (lang) {
    const normalized = lang.toLowerCase().replace("_", "-");
    const searchLang = LANG_ALIASES[normalized] ?? normalized;
    if (SUPPORTED_LANGS.has(searchLang)) params.set("search_lang", searchLang);
  }

  const freshness = tbsToFreshness(tbs);
  if (freshness) params.set("freshness", freshness);

  if (safe) params.set("safesearch", "strict");

  return params;
}

export async function braveSearch(
  term: string,
  num_results = 5,
  options: SearchOptions = {},
): Promise<SearchV2Response> {
  const apiKey = config.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    throw new Error("Brave search: BRAVE_SEARCH_API_KEY is not configured.");
  }
  if (num_results <= 0) return {};

  const { timeout = 5000 } = options;
  const params = buildParams(term, Math.min(MAX_COUNT, num_results), options);
  const dispatcher = getSecureDispatcher(false);
  const results: WebSearchResult[] = [];
  const seenUrls = new Set<string>();

  for (
    let offset = 0;
    offset <= MAX_OFFSET && results.length < num_results;
    offset++
  ) {
    params.set("offset", String(offset));

    const response = await undici.fetch(
      `${BRAVE_WEB_SEARCH_URL}?${params.toString()}`,
      {
        dispatcher,
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": apiKey,
        },
        signal: AbortSignal.timeout(timeout),
      },
    );
    const body = (await response.json().catch(() => undefined)) as
      | BraveWebSearchResponse
      | undefined;

    if (!response.ok) {
      const code = body?.error?.code ?? "UNKNOWN";
      const detail = body?.error?.detail ?? "";
      logger.error("Brave search error", {
        status: response.status,
        code,
        detail,
        term,
      });
      throw new Error(
        `Brave search failed: HTTP ${response.status} ${code} ${detail}`.trim(),
      );
    }

    for (const item of body?.web?.results ?? []) {
      if (!item.url || !item.title || seenUrls.has(item.url)) continue;
      seenUrls.add(item.url);
      results.push({
        url: item.url,
        title: decodeHtmlEntities(item.title),
        description: decodeHtmlEntities(item.description ?? ""),
      });
    }

    if (!body?.query?.more_results_available) break;
  }

  if (results.length === 0) {
    logger.warn("Brave search: No results found", { term });
    return {};
  }

  return { web: results.slice(0, num_results) };
}
