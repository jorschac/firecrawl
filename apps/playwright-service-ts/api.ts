import express, { Request, Response } from 'express';
import {
  chromium,
  Browser,
  BrowserContext,
  Route,
  Request as PlaywrightRequest,
  Page,
} from 'playwright';
import dotenv from 'dotenv';
import UserAgent from 'user-agents';
import { getError } from './helpers/get_error';
import { lookup } from 'dns/promises';
import IPAddr from 'ipaddr.js';
import { Server, RequestError } from 'proxy-chain';

dotenv.config();

const app = express();
const port = process.env.PORT || 3003;

app.use(express.json());

const BLOCK_MEDIA =
  (process.env.BLOCK_MEDIA || 'False').toUpperCase() === 'TRUE';
const MAX_CONCURRENT_PAGES = Math.max(
  1,
  Number.parseInt(process.env.MAX_CONCURRENT_PAGES ?? '10', 10) || 10,
);
const ALLOW_LOCAL_WEBHOOKS =
  (process.env.ALLOW_LOCAL_WEBHOOKS || 'False').toUpperCase() === 'TRUE';

const PROXY_SERVER = process.env.PROXY_SERVER || null;
const PROXY_USERNAME = process.env.PROXY_USERNAME || null;
const PROXY_PASSWORD = process.env.PROXY_PASSWORD || null;
const BROWSER_ENGINE = (process.env.BROWSER_ENGINE || 'chromium').toLowerCase();
const useObscura = BROWSER_ENGINE === 'obscura';
const OBSCURA_CDP_URLS = (
  process.env.OBSCURA_CDP_URLS ||
  process.env.OBSCURA_CDP_URL ||
  'http://127.0.0.1:9222'
)
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);
const OBSCURA_CDP_RETRIES = Math.max(
  1,
  Number.parseInt(process.env.OBSCURA_CDP_RETRIES ?? '30', 10) || 30,
);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class InsecureConnectionError extends Error {
  constructor(
    public readonly blockedUrl: string,
    reason: string,
  ) {
    super(`Blocked insecure target URL "${blockedUrl}": ${reason}`);
    this.name = 'InsecureConnectionError';
  }
}

const isInternalHost = async (hostname: string): Promise<boolean> => {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return true;

  let addresses: string[];
  if (IPAddr.isValid(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await lookup(host, { all: true })).map((a) => a.address);
    } catch {
      return true;
    }
  }
  return (
    addresses.length === 0 ||
    addresses.some((a) => IPAddr.parse(a).range() !== 'unicast')
  );
};

const assertSafeTargetUrl = async (urlString: string): Promise<void> => {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    throw new InsecureConnectionError(urlString, 'URL is invalid');
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new InsecureConnectionError(
      urlString,
      `unsupported protocol "${parsedUrl.protocol}"`,
    );
  }
  if (!ALLOW_LOCAL_WEBHOOKS && (await isInternalHost(parsedUrl.hostname))) {
    throw new InsecureConnectionError(
      urlString,
      'resolves to a private/internal address',
    );
  }
};

const buildUpstreamProxyUrl = (): string | undefined => {
  if (!PROXY_SERVER) return undefined;
  const server = PROXY_SERVER.includes('://')
    ? PROXY_SERVER
    : `http://${PROXY_SERVER}`;
  const url = new URL(server);
  if (PROXY_USERNAME) url.username = PROXY_USERNAME;
  if (PROXY_PASSWORD) url.password = PROXY_PASSWORD;
  return url.toString();
};

const startSSRFProxy = async (): Promise<number> => {
  const server = new Server({
    port: 0,
    host: '127.0.0.1',
    prepareRequestFunction: async ({ hostname }) => {
      if (!ALLOW_LOCAL_WEBHOOKS && (await isInternalHost(hostname))) {
        throw new RequestError(
          'Blocked: target resolves to a private/internal address',
          403,
        );
      }
      return { upstreamProxyUrl: buildUpstreamProxyUrl() };
    },
  });
  await server.listen();
  return server.port;
};

let ssrfProxyPort: number;

type ContextSecurityState = {
  blockedNavigationRequestUrl: string | null;
};
class Semaphore {
  private permits: number;
  private queue: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    if (this.queue.length > 0) {
      const nextResolve = this.queue.shift();
      if (nextResolve) {
        this.permits--;
        nextResolve();
      }
    }
  }

  getAvailablePermits(): number {
    return this.permits;
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

const AD_SERVING_DOMAINS = [
  'doubleclick.net',
  'adservice.google.com',
  'googlesyndication.com',
  'googletagservices.com',
  'googletagmanager.com',
  'google-analytics.com',
  'adsystem.com',
  'adservice.com',
  'adnxs.com',
  'ads-twitter.com',
  'facebook.net',
  'fbcdn.net',
  'amazon-adsystem.com',
];

interface UrlModel {
  url: string;
  wait_after_load?: number;
  timeout?: number;
  headers?: { [key: string]: string };
  check_selector?: string;
  skip_tls_verification?: boolean;
}

type BrowserSlot = {
  /** Obscura CDP endpoint, or null for a locally launched Chromium. */
  endpoint: string | null;
  browser: Browser | null;
  connecting: Promise<Browser> | null;
  activePages: number;
};

const browserSlots: BrowserSlot[] = (useObscura ? OBSCURA_CDP_URLS : [null]).map(
  (endpoint) => ({ endpoint, browser: null, connecting: null, activePages: 0 }),
);
const totalPageSlots = browserSlots.length * MAX_CONCURRENT_PAGES;
const pageSemaphore = new Semaphore(totalPageSlots);
let nextSlotIndex = 0;

const slotLabel = (slot: BrowserSlot) => slot.endpoint ?? 'chromium';

const rewriteLocalCdpWebSocketUrl = (
  webSocketDebuggerUrl: string,
  httpEndpoint: string,
): string => {
  const ws = new URL(webSocketDebuggerUrl);
  const http = new URL(httpEndpoint);
  if (
    ws.hostname === '127.0.0.1' ||
    ws.hostname === 'localhost' ||
    ws.hostname === '0.0.0.0' ||
    ws.hostname === '::1'
  ) {
    ws.hostname = http.hostname;
    if (http.port) {
      ws.port = http.port;
    }
  }
  return ws.toString();
};

const resolveCdpEndpoint = async (endpointURL: string): Promise<string> => {
  const parsed = new URL(endpointURL);
  if (parsed.protocol === 'ws:' || parsed.protocol === 'wss:') {
    return endpointURL;
  }

  const versionUrl = new URL('/json/version', endpointURL).toString();
  const response = await fetch(versionUrl);
  if (!response.ok) {
    throw new Error(`CDP /json/version returned ${response.status}`);
  }

  const body = (await response.json()) as { webSocketDebuggerUrl?: string };
  if (!body.webSocketDebuggerUrl) {
    throw new Error('CDP /json/version missing webSocketDebuggerUrl');
  }

  return rewriteLocalCdpWebSocketUrl(body.webSocketDebuggerUrl, endpointURL);
};

const connectOverCdpWithRetry = async (endpointURL: string): Promise<Browser> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= OBSCURA_CDP_RETRIES; attempt++) {
    try {
      const cdpEndpoint = await resolveCdpEndpoint(endpointURL);
      console.log(
        `Connecting to Obscura CDP at ${cdpEndpoint} (attempt ${attempt}/${OBSCURA_CDP_RETRIES})`,
      );
      return await chromium.connectOverCDP(cdpEndpoint, { timeout: 5000 });
    } catch (error) {
      lastError = error;
      console.warn(
        `Obscura CDP not ready: ${error instanceof Error ? error.message : error}`,
      );
      await sleep(1000);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to connect to Obscura CDP at ${endpointURL}`);
};

const openBrowser = async (slot: BrowserSlot): Promise<Browser> => {
  if (slot.endpoint) {
    const connected = await connectOverCdpWithRetry(slot.endpoint);
    console.log(`Connected to Obscura via CDP (${slot.endpoint})`);
    return connected;
  }

  return chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  });
};

const ensureBrowser = async (slot: BrowserSlot): Promise<Browser> => {
  if (slot.browser?.isConnected()) {
    return slot.browser;
  }
  if (!slot.connecting) {
    slot.connecting = openBrowser(slot)
      .then((opened) => {
        opened.on('disconnected', () => {
          console.warn(`Browser disconnected: ${slotLabel(slot)}`);
          if (slot.browser === opened) {
            slot.browser = null;
          }
        });
        slot.browser = opened;
        return opened;
      })
      .finally(() => {
        slot.connecting = null;
      });
  }
  return slot.connecting;
};

/** Waits for a free page slot, preferring the least busy browser and rotating on ties. */
const acquireBrowserSlot = async (): Promise<BrowserSlot> => {
  await pageSemaphore.acquire();
  const start = nextSlotIndex % browserSlots.length;
  let chosen: BrowserSlot | undefined;
  for (let i = 0; i < browserSlots.length; i++) {
    const candidate = browserSlots[(start + i) % browserSlots.length];
    if (candidate.activePages >= MAX_CONCURRENT_PAGES) continue;
    if (!chosen || candidate.activePages < chosen.activePages) {
      chosen = candidate;
    }
  }
  chosen ??= browserSlots[start];
  nextSlotIndex = (browserSlots.indexOf(chosen) + 1) % browserSlots.length;
  chosen.activePages++;
  return chosen;
};

const releaseBrowserSlot = (slot: BrowserSlot) => {
  slot.activePages = Math.max(0, slot.activePages - 1);
  pageSemaphore.release();
};

const CLOSE_TIMEOUT_MS = 5000;

/** Obscura can panic mid-navigation; page.close() then never settles and the slot stays taken. */
const closeBrowserResources = async (
  slot: BrowserSlot,
  page: Page | null,
  context: BrowserContext | null,
) => {
  const slotBrowser = slot.browser;
  let finished = false;
  const closing = (async () => {
    await page?.close().catch(() => {});
    await context?.close().catch(() => {});
    finished = true;
  })();
  const timeout = sleep(CLOSE_TIMEOUT_MS).then(() => {
    if (!finished) throw new Error('close timed out');
  });
  try {
    await Promise.race([closing, timeout]);
  } catch (error) {
    console.warn(
      `Closing the page on ${slotLabel(slot)} did not finish; dropping that browser connection`,
      error instanceof Error ? error.message : error,
    );
    if (slot.browser === slotBrowser) {
      slot.browser = null;
    }
  }
};

const createContext = async (
  browser: Browser,
  skipTlsVerification: boolean = false,
  userAgentOverride?: string,
): Promise<{
  context: BrowserContext;
  securityState: ContextSecurityState;
}> => {
  const userAgent = userAgentOverride || new UserAgent().toString();
  const viewport = { width: 1280, height: 800 };
  const securityState: ContextSecurityState = {
    blockedNavigationRequestUrl: null,
  };

  const contextOptions: any = {
    userAgent,
    viewport,
    ignoreHTTPSErrors: skipTlsVerification,
  };

  // Obscura's CDP subset does not implement service worker routing the same
  // way Chromium does. Upstream proxy is also owned by `obscura serve --proxy`.
  if (!useObscura) {
    contextOptions.serviceWorkers = 'block';
    contextOptions.proxy = {
      server: `http://127.0.0.1:${ssrfProxyPort}`,
    };
  }

  const newContext = await browser.newContext(contextOptions);

  const installRoutes = async () => {
    if (BLOCK_MEDIA) {
      await newContext.route(
        '**/*.{png,jpg,jpeg,gif,svg,mp3,mp4,avi,flac,ogg,wav,webm}',
        async (route: Route, request: PlaywrightRequest) => {
          await route.abort();
        },
      );
    }

    // Intercept all requests to avoid loading ads
    await newContext.route(
      '**/*',
      async (route: Route, request: PlaywrightRequest) => {
        const requestUrlString = request.url();
        try {
          await assertSafeTargetUrl(requestUrlString);
        } catch (error) {
          if (error instanceof InsecureConnectionError) {
            if (request.isNavigationRequest()) {
              securityState.blockedNavigationRequestUrl = requestUrlString;
            }
            console.warn(`Blocked request: ${requestUrlString}`);
            return route.abort('blockedbyclient');
          }
          throw error;
        }

        const hostname = new URL(requestUrlString).hostname.toLowerCase();

        if (AD_SERVING_DOMAINS.some((domain) => hostname.includes(domain))) {
          console.log(hostname);
          return route.abort();
        }
        return route.continue();
      },
    );
  };

  try {
    await installRoutes();
  } catch (error) {
    if (!useObscura) {
      throw error;
    }
    console.warn(
      'Obscura does not support Playwright request routing; continuing without route hooks',
      error instanceof Error ? error.message : error,
    );
  }

  return { context: newContext, securityState };
};

const shutdownBrowser = async () => {
  await Promise.all(
    browserSlots.map((slot) => slot.browser?.close().catch(() => {})),
  );
};

const isValidUrl = (urlString: string): boolean => {
  try {
    new URL(urlString);
    return true;
  } catch (_) {
    return false;
  }
};

const scrapePage = async (
  page: Page,
  url: string,
  waitUntil: 'load' | 'networkidle',
  waitAfterLoad: number,
  timeout: number,
  checkSelector: string | undefined,
  securityState: ContextSecurityState,
) => {
  console.log(
    `Navigating to ${url} with waitUntil: ${waitUntil} and timeout: ${timeout}ms`,
  );
  let response;
  try {
    response = await page.goto(url, { waitUntil, timeout });
  } catch (error) {
    if (securityState.blockedNavigationRequestUrl) {
      throw new InsecureConnectionError(
        securityState.blockedNavigationRequestUrl,
        'navigation to private/internal resource is not allowed',
      );
    }
    throw error;
  }

  if (waitAfterLoad > 0) {
    await page.waitForTimeout(waitAfterLoad);
  }

  if (checkSelector) {
    try {
      await page.waitForSelector(checkSelector, { timeout });
    } catch (error) {
      throw new Error('Required selector not found');
    }
  }

  let headers = null,
    content = await page.content();
  let ct: string | undefined = undefined;
  if (response) {
    headers = await response.allHeaders();
    ct = Object.entries(headers).find(
      ([key]) => key.toLowerCase() === 'content-type',
    )?.[1];
    if (
      ct &&
      (ct.toLowerCase().includes('application/json') ||
        ct.toLowerCase().includes('text/plain'))
    ) {
      content = (await response.body()).toString('utf8'); // TODO: determine real encoding
    }
  }

  // Obscura's CDP subset often completes navigation without a Playwright
  // Response object. Content can still be present via page.content().
  const status =
    response?.status() ?? (useObscura && content ? 200 : null);

  return {
    content,
    status,
    headers,
    contentType: ct,
  };
};

app.get('/health', async (req: Request, res: Response) => {
  try {
    const browsers = await Promise.all(browserSlots.map(ensureBrowser));

    // Opening a probe page on a busy Obscura instance breaks the page already
    // loading there, so Obscura health is connection-only.
    if (!useObscura) {
      const { context: testContext } = await createContext(browsers[0]);
      const testPage = await testContext.newPage();
      await testPage.close();
      await testContext.close();
    }

    res.status(200).json({
      status: 'healthy',
      maxConcurrentPages: totalPageSlots,
      activePages: totalPageSlots - pageSemaphore.getAvailablePermits(),
      queuedRequests: pageSemaphore.getQueueLength(),
      browsers: browserSlots.map((slot) => ({
        endpoint: slotLabel(slot),
        connected: !!slot.browser?.isConnected(),
        activePages: slot.activePages,
      })),
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

app.post('/scrape', async (req: Request, res: Response) => {
  const {
    url,
    wait_after_load = 0,
    timeout = 15000,
    headers,
    check_selector,
    skip_tls_verification = false,
  }: UrlModel = req.body;

  console.log(`================= Scrape Request =================`);
  console.log(`URL: ${url}`);
  console.log(`Wait After Load: ${wait_after_load}`);
  console.log(`Timeout: ${timeout}`);
  console.log(`Headers: ${headers ? JSON.stringify(headers) : 'None'}`);
  console.log(`Check Selector: ${check_selector ? check_selector : 'None'}`);
  console.log(`Skip TLS Verification: ${skip_tls_verification}`);
  console.log(`==================================================`);

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    await assertSafeTargetUrl(url);
  } catch (error) {
    if (error instanceof InsecureConnectionError) {
      return res.json({
        content: '',
        pageStatusCode: 403,
        pageError: error.message,
      });
    }
    throw error;
  }

  if (!PROXY_SERVER) {
    console.warn(
      '⚠️ WARNING: No proxy server provided. Your IP address may be blocked.',
    );
  }

  const slot = await acquireBrowserSlot();

  let requestContext: BrowserContext | null = null;
  let securityState: ContextSecurityState | null = null;
  let page: Page | null = null;

  try {
    const slotBrowser = await ensureBrowser(slot);
    console.log(
      `Browser: ${slotLabel(slot)} (${slot.activePages}/${MAX_CONCURRENT_PAGES} on this instance)`,
    );

    // Extract user-agent from request headers (case-insensitive) so it can
    // be applied at the context level.  Playwright ignores user-agent in
    // setExtraHTTPHeaders when the context already defines one (#2802).
    const userAgentOverride = headers
      ? Object.entries(headers).find(
          ([k]) => k.toLowerCase() === 'user-agent',
        )?.[1]
      : undefined;

    const contextBundle = await createContext(
      slotBrowser,
      skip_tls_verification,
      userAgentOverride,
    );
    requestContext = contextBundle.context;
    securityState = contextBundle.securityState;
    page = await requestContext.newPage();

    if (headers) {
      // A Cookie header passed through setExtraHTTPHeaders is sent on the first
      // request but DROPPED on any redirect hop (the browser regenerates the
      // redirected request from its cookie jar, which is empty). Authenticated
      // sites that 302 (e.g. to /signin when the session looks absent) then
      // land on the login page. Seed the cookie jar instead so Chromium re-sends
      // it on every request, including redirects — matching what a raw HTTP
      // client does.
      const cookieHeader = Object.entries(headers).find(
        ([k]) => k.toLowerCase() === 'cookie',
      )?.[1];
      if (cookieHeader) {
        // Scope cookies to the registrable domain (e.g. ".example.com"), not
        // host-only. Authenticated pages often 302 across sibling subdomains
        // (example.com -> app.example.com); a host-only cookie set for the
        // original host would not be sent to the redirect target, leaving the
        // request unauthenticated. The Cookie header carries no domain info, so
        // we apply the eTLD+1 — broad enough to follow the redirect, and these
        // are first-party cookies being returned to their own origin anyway.
        let cookieDomain: string | undefined;
        try {
          const host = new URL(url).hostname;
          const labels = host.split('.');
          cookieDomain = labels.length > 2 ? labels.slice(-2).join('.') : host;
        } catch {
          cookieDomain = undefined;
        }
        type SeedCookie = {
          name: string;
          value: string;
          url?: string;
          domain?: string;
          path?: string;
        };
        const cookies = cookieHeader
          .split(';')
          .map((pair) => pair.trim())
          .filter(Boolean)
          .map((pair): SeedCookie | null => {
            const eq = pair.indexOf('=');
            if (eq === -1) return null;
            const name = pair.slice(0, eq).trim();
            const value = pair.slice(eq + 1).trim();
            return cookieDomain
              ? { name, value, domain: `.${cookieDomain}`, path: '/' }
              : { name, value, url };
          })
          .filter((c): c is SeedCookie => c !== null);
        if (cookies.length > 0) {
          try {
            await requestContext.addCookies(cookies);
          } catch (error) {
            console.warn('Failed to seed cookies from Cookie header:', error);
          }
        }
      }

      // Remove user-agent (already applied at the context level) and cookie
      // (now seeded into the jar) before forwarding the rest verbatim.
      const filteredHeaders = Object.fromEntries(
        Object.entries(headers).filter(([k]) => {
          const lower = k.toLowerCase();
          return lower !== 'user-agent' && lower !== 'cookie';
        }),
      );
      if (Object.keys(filteredHeaders).length > 0) {
        await page.setExtraHTTPHeaders(filteredHeaders);
      }
    }

    const result = await scrapePage(
      page,
      url,
      'load',
      wait_after_load,
      timeout,
      check_selector,
      securityState,
    );
    const pageError =
      result.status !== 200 ? getError(result.status) : undefined;

    if (!pageError) {
      console.log(`✅ Scrape successful!`);
    } else {
      console.log(
        `🚨 Scrape failed with status code: ${result.status} ${pageError}`,
      );
    }

    res.json({
      content: result.content,
      pageStatusCode: result.status,
      contentType: result.contentType,
      ...(pageError && { pageError }),
    });
  } catch (error) {
    if (error instanceof InsecureConnectionError) {
      return res.json({
        content: '',
        pageStatusCode: 403,
        pageError: error.message,
      });
    }
    console.error('Scrape error:', error);
    res
      .status(500)
      .json({ error: 'An error occurred while fetching the page.' });
  } finally {
    await closeBrowserResources(slot, page, requestContext);
    releaseBrowserSlot(slot);
  }
});

const start = async () => {
  ssrfProxyPort = await startSSRFProxy();
  console.log(
    `Browser engine: ${useObscura ? 'obscura' : 'chromium'}` +
      (useObscura ? ` (${OBSCURA_CDP_URLS.join(', ')})` : '') +
      `, ${MAX_CONCURRENT_PAGES} page(s) per browser`,
  );
  const started = await Promise.allSettled(browserSlots.map(ensureBrowser));
  for (const [i, result] of started.entries()) {
    if (result.status === 'rejected') {
      console.warn(
        `Browser not ready at startup (${slotLabel(browserSlots[i])}): ${
          result.reason instanceof Error ? result.reason.message : result.reason
        }`,
      );
    }
  }
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
};
start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

if (require.main === module) {
  process.on('SIGINT', () => {
    shutdownBrowser().then(() => {
      console.log('Browser closed');
      process.exit(0);
    });
  });
}
