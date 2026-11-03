import { SearchResult, SearchV2Response } from "../../src/lib/entities";
import { config } from "../config";
import { searxng_search } from "./searxng";
import { fire_engine_search } from "./fireEngine";
import { Logger } from "winston";
import { ddgSearch } from "./v2/ddgsearch";
import { braveSearch } from "./v2/bravesearch";

export async function search({
  query,
  logger,
  advanced = false,
  num_results = 5,
  tbs = undefined,
  filter = undefined,
  lang = "en",
  country = "us",
  location = undefined,
  proxy = undefined,
  sleep_interval = 0,
  timeout = 5000,
}: {
  query: string;
  logger: Logger;
  advanced?: boolean;
  num_results?: number;
  tbs?: string;
  filter?: string;
  lang?: string;
  country?: string;
  location?: string;
  proxy?: string;
  sleep_interval?: number;
  timeout?: number;
}): Promise<SearchResult[]> {
  try {
    if (config.FIRE_ENGINE_BETA_URL) {
      logger.info("Using fire engine search");
      const results = await fire_engine_search(query, {
        numResults: num_results,
        tbs,
        filter,
        lang,
        country,
        location,
      });
      return results;
    }
    if (config.SEARXNG_ENDPOINT) {
      logger.info("Using searxng search");
      const results = await searxng_search(query, {
        num_results,
        tbs,
        filter,
        lang,
        country,
        location,
      });
      if (results.length > 0) return results;
    }
    let webResults: SearchV2Response;
    if (config.BRAVE_SEARCH_API_KEY) {
      logger.info("Using Brave search");
      webResults = await braveSearch(query, num_results, {
        tbs,
        lang,
        country,
        timeout,
      });
    } else {
      logger.info("Using DuckDuckGo search");
      webResults = await ddgSearch(query, num_results, {
        tbs,
        lang,
        country,
        proxy,
        timeout,
      });
    }
    return (
      webResults.web?.map(
        result =>
          new SearchResult(result.url, result.title, result.description),
      ) || []
    );
  } catch (error) {
    logger.error(`Error in search function`, { error });
    return [];
  }
}
