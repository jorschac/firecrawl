#!/usr/bin/env node
// Follow Firecrawl container logs and append a raw transcript plus a short event index.
import http from "node:http";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "logs", "firecrawl-trace");
const socketPath =
  process.env.DOCKER_HOST?.startsWith("unix://")
    ? process.env.DOCKER_HOST.slice("unix://".length)
    : execFileSync(
        "docker",
        ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
        { encoding: "utf8" },
      )
        .trim()
        .replace(/^unix:\/\//, "");

const SERVICES = ["api", "playwright-service", "obscura", "obscura-2", "redis"];
const ansi = /\x1b\[[0-9;]*m/g;
const rules = [
  [/Reached heap limit|heap out of memory|FATAL ERROR/i, "heap_oom"],
  [/rate limit exceeded/i, "rate_limit"],
  [/rate limiter failed open/i, "rate_limit_failopen"],
  [/Brave search error|Brave search: No results|DuckDuckGo: /i, "search_backend_fail"],
  [/Using (Brave|DuckDuckGo|searxng|fire engine) search/i, "search_backend"],
  [/Truncating HTML before markdown conversion/i, "truncate"],
  [/Waterfalling to next engine/i, "waterfall"],
  [/Go parser|html-to-markdown/i, "markdown_parser"],
  [/deemed successful/i, "engine_ok"],
  [/deemed unsuccessful|unexpected error|TargetClosed|Scrape error/i, "engine_fail"],
  [/Scraping URL /i, "scrape_url"],
  [/Scraping via /i, "engine_start"],
  [/Navigating to /i, "playwright_nav"],
  [/Scrape successful/i, "playwright_ok"],
  [/Error occurred in request/i, "request_error"],
  [/\/v\d\/(scrape|search|map)\b/i, "http_route"],
];

fs.mkdirSync(outDir, { recursive: true });
const raw = fs.createWriteStream(path.join(outDir, "raw.log"), { flags: "a" });
const events = fs.createWriteStream(path.join(outDir, "events.jsonl"), {
  flags: "a",
});
const pidFile = path.join(outDir, "trace.pid");

function alreadyRunning() {
  if (!fs.existsSync(pidFile)) return false;
  const old = Number(fs.readFileSync(pidFile, "utf8").trim());
  if (!old) return false;
  try {
    process.kill(old, 0);
    return old;
  } catch {
    return false;
  }
}

const existing = alreadyRunning();
if (existing) {
  console.log(`firecrawl trace already running pid ${existing}`);
  process.exit(0);
}
fs.writeFileSync(pidFile, String(process.pid));

const stopping = { value: false };
function shutdown() {
  stopping.value = true;
  raw.end();
  events.end();
  try {
    if (fs.readFileSync(pidFile, "utf8").trim() === String(process.pid)) {
      fs.unlinkSync(pidFile);
    }
  } catch {
    // pid file already removed
  }
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function containerNames() {
  const lines = execFileSync(
    "docker",
    ["ps", "--format", "{{.Names}}\t{{.Label \"com.docker.compose.service\"}}"],
    { encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .filter(Boolean);
  const found = [];
  for (const line of lines) {
    const [name, service] = line.split("\t");
    if (SERVICES.includes(service)) found.push({ name, service });
  }
  return found;
}

function classify(line) {
  for (const [pattern, kind] of rules) {
    if (pattern.test(line)) return kind;
  }
  return null;
}

function record(service, chunk) {
  const text = chunk.replace(ansi, "").replace(/\r/g, "");
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    raw.write(`${service}\t${line}\n`);
    const kind = classify(line);
    if (!kind) continue;
    events.write(
      JSON.stringify({
        t: new Date().toISOString(),
        service,
        kind,
        msg: line.slice(0, 2000),
      }) + "\n",
    );
  }
}

function follow(container) {
  const since =
    Math.floor(Date.now() / 1000) -
    Number(process.env.TRACE_SINCE_SECONDS ?? 15 * 60);
  const pathName =
    `/v1.54/containers/${encodeURIComponent(container.name)}/logs` +
    `?follow=1&stdout=1&stderr=1&timestamps=1&since=${since}`;

  const req = http.request(
    { socketPath, path: pathName, method: "GET", timeout: 0 },
    (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        record(container.service, `trace follow failed status ${res.statusCode}`);
        return;
      }
      let buf = Buffer.alloc(0);
      res.on("data", (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        while (buf.length >= 8) {
          const size = buf.readUInt32BE(4);
          if (buf.length < 8 + size) break;
          record(container.service, buf.subarray(8, 8 + size).toString("utf8"));
          buf = buf.subarray(8 + size);
        }
      });
      res.on("end", () => {
        if (!stopping.value) {
          setTimeout(() => follow(container), 1000);
        }
      });
    },
  );
  req.on("error", (error) => {
    record(container.service, `trace follow error ${error.message}`);
    if (!stopping.value) setTimeout(() => follow(container), 2000);
  });
  req.end();
}

const containers = containerNames();
if (containers.length === 0) {
  console.error("no firecrawl containers to follow");
  shutdown();
}
raw.write(
  `\n# trace start ${new Date().toISOString()} pid ${process.pid} containers ${containers.map((c) => c.name).join(",")}\n`,
);
for (const container of containers) follow(container);
console.log(
  `firecrawl trace pid ${process.pid} -> ${path.join(outDir, "events.jsonl")}`,
);
