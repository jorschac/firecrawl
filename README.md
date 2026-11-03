---

# **🔥 Firecrawl**

**The API to search, scrape, and interact with the web at scale. 🔥** The web context API to find sources, extract content, and turn it into clean Markdown or structured data your agents can ship with. Open source and available as a [hosted service](https://firecrawl.dev/?ref=github).

*Pst. Hey, you, join our stargazers :)*

---

## Why Firecrawl?

- **Industry-leading reliability**: Covers 96% of the web, including JS-heavy pages — no proxy headaches, just clean data ([see benchmarks](https://www.firecrawl.dev/blog/the-worlds-best-web-data-api-v25))
- **Blazingly fast**: P95 latency of 3.4s across millions of pages, built for real-time agents and dynamic apps
- **LLM-ready output**: Clean markdown, structured JSON, screenshots, and more — spend fewer tokens, build better AI apps
- **We handle the hard stuff**: Rotating proxies, orchestration, rate limits, JS-blocked content, and more — zero configuration
- **Agent ready**: Connect Firecrawl to any AI agent or MCP client with a single command
- **Media parsing**: Parse and extract content from web-hosted PDFs, DOCX, and more
- **Actions**: Click, scroll, write, wait, and press before extracting content
- **Open source**: Developed transparently and collaboratively — [join our community](https://discord.gg/firecrawl)

---



## Feature Overview

**Core Endpoints**


| Feature                   | Description                                                        |
| ------------------------- | ------------------------------------------------------------------ |
| **[Search](#search)**     | Search the web and get full page content from results              |
| **[Scrape](#scrape)**     | Convert any URL to markdown, HTML, screenshots, or structured JSON |
| **[Interact](#interact)** | Scrape a page, then interact with it using AI prompts or code      |


**More**


| Feature                           | Description                                           |
| --------------------------------- | ----------------------------------------------------- |
| **[Agent](#agent)**               | Automated data gathering, just describe what you need |
| **[Crawl](#crawl)**               | Scrape all URLs of a website with a single request    |
| **[Map](#map)**                   | Discover all URLs on a website instantly              |
| **[Batch Scrape](#batch-scrape)** | Scrape thousands of URLs asynchronously               |


---



## Quick Start

Sign up at [firecrawl.dev](https://firecrawl.dev) to get your API key. Try the [playground](https://firecrawl.dev/playground) to test it out.

### Search

Search the web and get full content from results.

```python
from firecrawl import Firecrawl

app = Firecrawl(api_key="fc-YOUR_API_KEY")

search_result = app.search("firecrawl", limit=5)
```

**Node.js / cURL / CLI**

**Node.js**

```javascript
import { Firecrawl } from 'firecrawl';

const app = new Firecrawl({apiKey: "fc-YOUR_API_KEY"});

app.search("firecrawl", { limit: 5 })
```

**cURL**

```bash
curl -X POST 'https://api.firecrawl.dev/v2/search' \
-H 'Authorization: Bearer fc-YOUR_API_KEY' \
-H 'Content-Type: application/json' \
-d '{
  "query": "firecrawl",
  "limit": 5
}'
```

**CLI**

```bash
firecrawl search "firecrawl" --limit 5
```

Output:

```json
[
  {
    "url": "https://firecrawl.dev",
    "title": "Firecrawl",
    "markdown": "Turn websites into..."
  },
  {
    "url": "https://docs.firecrawl.dev",
    "title": "Firecrawl Docs",
    "markdown": "# Getting Started..."
  }
]
```



### Scrape

Get LLM-ready data from any website — markdown, JSON, screenshots, and more.

```python
from firecrawl import Firecrawl

app = Firecrawl(api_key="fc-YOUR_API_KEY")

result = app.scrape('firecrawl.dev')
```

**Node.js / cURL / CLI**

**Node.js**

```javascript
import { Firecrawl } from 'firecrawl';

const app = new Firecrawl({ apiKey: "fc-YOUR_API_KEY" });

app.scrape('firecrawl.dev')
```

**cURL**

```bash
curl -X POST 'https://api.firecrawl.dev/v2/scrape' \
-H 'Authorization: Bearer fc-YOUR_API_KEY' \
-H 'Content-Type: application/json' \
-d '{
  "url": "firecrawl.dev"
}'
```

**CLI**

```bash
firecrawl scrape https://firecrawl.dev
firecrawl https://firecrawl.dev --only-main-content
```

Output:

```
# Firecrawl

Firecrawl helps AI agents search, scrape, and interact with the web.

## Features
- Search: Find information across the web
- Scrape: Clean data from any page
- Interact: Click, navigate, and operate pages
- Agent: Autonomous data gathering
```



### Interact

Scrape a page, then interact with it using AI prompts or code.

```python
from firecrawl import Firecrawl

app = Firecrawl(api_key="fc-YOUR_API_KEY")

result = app.scrape("https://amazon.com")
scrape_id = result.metadata.scrape_id

app.interact(scrape_id, prompt="Search for 'mechanical keyboard'")
app.interact(scrape_id, prompt="Click the first result")
```

**Node.js / cURL / CLI**

**Node.js**

```javascript
import { Firecrawl } from 'firecrawl';

const app = new Firecrawl({apiKey: "fc-YOUR_API_KEY"});

const result = await app.scrape("https://amazon.com");

await app.interact(result.metadata.scrapeId, {
  prompt: "Search for 'mechanical keyboard'"
});
await app.interact(result.metadata.scrapeId, {
  prompt: "Click the first result"
});
```

**cURL**

```bash
# 1. Scrape the page
curl -X POST 'https://api.firecrawl.dev/v2/scrape' \
-H 'Authorization: Bearer fc-YOUR_API_KEY' \
-H 'Content-Type: application/json' \
-d '{"url": "https://amazon.com"}'

# 2. Interact with the page (use scrapeId from step 1)
curl -X POST 'https://api.firecrawl.dev/v2/scrape/SCRAPE_ID/interact' \
-H 'Authorization: Bearer fc-YOUR_API_KEY' \
-H 'Content-Type: application/json' \
-d '{"prompt": "Search for mechanical keyboard"}'
```

**CLI**

```bash
firecrawl scrape https://amazon.com
firecrawl interact exec --prompt "Search for 'mechanical keyboard'"
firecrawl interact exec --prompt "Click the first result"
```

Output:

```json
{
  "success": true,
  "output": "Keyboard available at $100",
  "liveViewUrl": "https://liveview.firecrawl.dev/..."
}
```

---



## Power Your Agent

Connect Firecrawl to any AI agent or MCP client in minutes.

### Skill

Give your agent easy access to real-time web data with one command.

```bash
npx -y firecrawl-cli@latest init --all --browser
```

Restart your agent after installing. Works with [Claude Code](https://claude.ai/code), [Antigravity](https://antigravity.google), [OpenCode](https://opencode.ai), and more.

### MCP

Connect any MCP-compatible client to the web in seconds.

```json
{
  "mcpServers": {
    "firecrawl-mcp": {
      "command": "npx",
      "args": ["-y", "firecrawl-mcp"],
      "env": {
        "FIRECRAWL_API_KEY": "fc-YOUR_API_KEY"
      }
    }
  }
}
```



### Agent Onboarding

Are you an AI agent? Fetch this skill to sign up your user, get an API key, and start building with Firecrawl.

```bash
curl -s https://firecrawl.dev/agent-onboarding/SKILL.md
```

See the [Skill + CLI documentation](https://docs.firecrawl.dev/sdks/cli) for all available commands. For MCP, see [firecrawl-mcp-server](https://github.com/firecrawl/firecrawl-mcp-server).

---



## More Endpoints



### Agent

**The easiest way to get data from the web.** Describe what you need, and our AI agent searches, navigates, and retrieves it. No URLs required.

Agent is the evolution of our `/extract` endpoint: faster, more reliable, and doesn't require you to know the URLs upfront.

```bash
curl -X POST 'https://api.firecrawl.dev/v2/agent' \
  -H 'Authorization: Bearer fc-YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "Find the pricing plans for Notion"
  }'
```

Response:

```json
{
  "success": true,
  "data": {
    "result": "Notion offers the following pricing plans:\n\n1. Free - $0/month...\n2. Plus - $10/seat/month...\n3. Business - $18/seat/month...",
    "sources": ["https://www.notion.so/pricing"]
  }
}
```



#### Agent with Structured Output

Use a schema to get structured data:

```python
from firecrawl import Firecrawl
from pydantic import BaseModel, Field
from typing import List, Optional

app = Firecrawl(api_key="fc-YOUR_API_KEY")

class Founder(BaseModel):
    name: str = Field(description="Full name of the founder")
    role: Optional[str] = Field(None, description="Role or position")

class FoundersSchema(BaseModel):
    founders: List[Founder] = Field(description="List of founders")

result = app.agent(
    prompt="Find the founders of Firecrawl",
    schema=FoundersSchema
)

print(result.data)
```

```json
{
  "founders": [
    {"name": "Eric Ciarla", "role": "Co-founder"},
    {"name": "Nicolas Camara", "role": "Co-founder"},
    {"name": "Caleb Peffer", "role": "Co-founder"}
  ]
}
```



#### Agent with URLs (Optional)

Focus the agent on specific pages:

```python
result = app.agent(
    urls=["https://docs.firecrawl.dev", "https://firecrawl.dev/pricing"],
    prompt="Compare the features and pricing information"
)
```



#### Model Selection

Choose between two models based on your needs:


| Model                    | Cost        | Best For                                  |
| ------------------------ | ----------- | ----------------------------------------- |
| `spark-1-mini` (default) | 60% cheaper | Most tasks                                |
| `spark-1-pro`            | Standard    | Complex research, critical data gathering |


```python
result = app.agent(
    prompt="Compare enterprise features across Firecrawl, Apify, and ScrapingBee",
    model="spark-1-pro"
)
```

**When to use Pro:**

- Comparing data across multiple websites
- Extracting from sites with complex navigation or auth
- Research tasks where the agent needs to explore multiple paths
- Critical data where accuracy is paramount

Learn more about Spark models in our [Agent documentation](https://docs.firecrawl.dev/features/agent).

### Crawl

Crawl an entire website and get content from all pages.

```bash
curl -X POST 'https://api.firecrawl.dev/v2/crawl' \
  -H 'Authorization: Bearer fc-YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://docs.firecrawl.dev",
    "limit": 100,
    "scrapeOptions": {
      "formats": ["markdown"]
    }
  }'
```

Returns a job ID:

```json
{
  "success": true,
  "id": "123-456-789",
  "url": "https://api.firecrawl.dev/v2/crawl/123-456-789"
}
```



#### Check Crawl Status

```bash
curl -X GET 'https://api.firecrawl.dev/v2/crawl/123-456-789' \
  -H 'Authorization: Bearer fc-YOUR_API_KEY'
```

```json
{
  "status": "completed",
  "total": 50,
  "completed": 50,
  "creditsUsed": 50,
  "data": [
    {
      "markdown": "# Page Title\n\nContent...",
      "metadata": {"title": "Page Title", "sourceURL": "https://..."}
    }
  ]
}
```

**Note:** The [SDKs](#sdks) handle polling automatically for a better developer experience.

### Map

Discover all URLs on a website instantly.

```bash
curl -X POST 'https://api.firecrawl.dev/v2/map' \
  -H 'Authorization: Bearer fc-YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://firecrawl.dev"}'
```

Response:

```json
{
  "success": true,
  "links": [
    {"url": "https://firecrawl.dev", "title": "Firecrawl", "description": "Turn websites into LLM-ready data"},
    {"url": "https://firecrawl.dev/pricing", "title": "Pricing", "description": "Firecrawl pricing plans"},
    {"url": "https://firecrawl.dev/blog", "title": "Blog", "description": "Firecrawl blog"}
  ]
}
```



#### Map with Search

Find specific URLs within a site:

```python
from firecrawl import Firecrawl

app = Firecrawl(api_key="fc-YOUR_API_KEY")

result = app.map("https://firecrawl.dev", search="pricing")
# Returns URLs ordered by relevance to "pricing"
```



### Batch Scrape

Scrape multiple URLs at once:

```python
from firecrawl import Firecrawl

app = Firecrawl(api_key="fc-YOUR_API_KEY")

job = app.batch_scrape([
    "https://firecrawl.dev",
    "https://docs.firecrawl.dev",
    "https://firecrawl.dev/pricing"
], formats=["markdown"])

for doc in job.data:
    print(doc.metadata.source_url)
```

---



## SDKs

Our SDKs provide a convenient way to use all Firecrawl features and automatically handle polling for async operations.

### Python

Install the SDK:

```bash
pip install firecrawl-py
```

```python
from firecrawl import Firecrawl

app = Firecrawl(api_key="fc-YOUR_API_KEY")

# Scrape a single URL
doc = app.scrape("https://firecrawl.dev", formats=["markdown"])
print(doc.markdown)

# Use the Agent for autonomous data gathering
result = app.agent(prompt="Find the founders of Stripe")
print(result.data)

# Crawl a website (automatically waits for completion)
docs = app.crawl("https://docs.firecrawl.dev", limit=50)
for doc in docs.data:
    print(doc.metadata.source_url, doc.markdown[:100])

# Search the web
results = app.search("best AI data tools 2024", limit=10)
print(results)
```



### Node.js

Install the SDK:

```bash
npm install firecrawl
```

```javascript
import { Firecrawl } from 'firecrawl';

const app = new Firecrawl({ apiKey: 'fc-YOUR_API_KEY' });

// Scrape a single URL
const doc = await app.scrape('https://firecrawl.dev', { formats: ['markdown'] });
console.log(doc.markdown);

// Use the Agent for autonomous data gathering
const result = await app.agent({ prompt: 'Find the founders of Stripe' });
console.log(result.data);

// Crawl a website (automatically waits for completion)
const docs = await app.crawl('https://docs.firecrawl.dev', { limit: 50 });
docs.data.forEach(doc => {
    console.log(doc.metadata.sourceURL, doc.markdown.substring(0, 100));
});

// Search the web
const results = await app.search('best AI data tools 2024', { limit: 10 });
results.data.web.forEach(result => {
    console.log(`${result.title}: ${result.url}`);
});
```



### Go

Install the SDK:

```bash
go get github.com/firecrawl/firecrawl/apps/go-sdk
```

```go
package main

import (
	"context"
	"fmt"
	"log"

	firecrawl "github.com/firecrawl/firecrawl/apps/go-sdk"
	"github.com/firecrawl/firecrawl/apps/go-sdk/option"
)

func main() {
	// Create a client (reads FIRECRAWL_API_KEY from environment)
	client, err := firecrawl.NewClient(option.WithAPIKey("fc-YOUR_API_KEY"))
	if err != nil {
		log.Fatal(err)
	}

	ctx := context.Background()

	// Scrape a single URL
	doc, err := client.Scrape(ctx, "https://firecrawl.dev", &firecrawl.ScrapeOptions{
		Formats: []string{"markdown"},
	})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(doc.Markdown)

	// Use the Agent for autonomous data gathering
	agent, err := client.Agent(ctx, &firecrawl.AgentOptions{
		Prompt: "Find the founders of Stripe",
	})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(agent.Data)

	// Crawl a website (automatically waits for completion)
	job, err := client.Crawl(ctx, "https://docs.firecrawl.dev", &firecrawl.CrawlOptions{
		Limit: firecrawl.Int(50),
	})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Crawled %d pages\n", len(job.Data))

	// Search the web
	results, err := client.Search(ctx, "best AI data tools 2024", &firecrawl.SearchOptions{
		Limit: firecrawl.Int(10),
	})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(results)
}
```



### Java

Add the dependency ([Gradle/Maven](https://docs.firecrawl.dev/sdks/java#installation)):

```groovy
repositories {
    mavenCentral()
    maven { url 'https://jitpack.io' }
}

dependencies {
    implementation 'com.github.firecrawl:firecrawl-java-sdk:2.0'
}
```

```java
import dev.firecrawl.client.FirecrawlClient;
import dev.firecrawl.model.*;

FirecrawlClient client = new FirecrawlClient(
    System.getenv("FIRECRAWL_API_KEY"), null, null
);

// Scrape a single URL
ScrapeParams scrapeParams = new ScrapeParams();
scrapeParams.setFormats(new String[]{"markdown"});
FirecrawlDocument doc = client.scrapeURL("https://firecrawl.dev", scrapeParams);
System.out.println(doc.getMarkdown());

// Use the Agent for autonomous data gathering
AgentParams agentParams = new AgentParams("Find the founders of Stripe");
AgentResponse start = client.createAgent(agentParams);
AgentStatusResponse result = client.getAgentStatus(start.getId());
System.out.println(result.getData());

// Crawl a website (polls until completion)
CrawlParams crawlParams = new CrawlParams();
crawlParams.setLimit(50);
CrawlStatusResponse job = client.crawlURL("https://docs.firecrawl.dev", crawlParams, null, 10);
for (FirecrawlDocument page : job.getData()) {
    System.out.println(page.getMetadata().get("sourceURL"));
}

// Search the web
SearchParams searchParams = new SearchParams("best AI data tools 2024");
searchParams.setLimit(10);
SearchResponse results = client.search(searchParams);
for (SearchResult r : results.getResults()) {
    System.out.println(r.getTitle() + ": " + r.getUrl());
}
```



### Elixir

Add the dependency:

```elixir
def deps do
  [
    {:firecrawl, "~> 1.0"}
  ]
end
```

```elixir
# Scrape a URL
{:ok, response} = Firecrawl.scrape_and_extract_from_url(
  url: "https://firecrawl.dev",
  formats: ["markdown"]
)

# Crawl a website
{:ok, response} = Firecrawl.crawl_urls(
  url: "https://docs.firecrawl.dev",
  limit: 50
)

# Search the web
{:ok, response} = Firecrawl.search_and_scrape(
  query: "best AI data tools 2024",
  limit: 10
)

# Map URLs
{:ok, response} = Firecrawl.map_urls(url: "https://example.com")
```



### Rust

Add the dependency:

```toml
[dependencies]
firecrawl = "2"
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
```

```rust
use firecrawl::{Client, ScrapeOptions, Format, CrawlOptions};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::new("fc-YOUR_API_KEY")?;

    // Scrape a URL
    let document = client.scrape("https://firecrawl.dev", None).await?;
    println!("{:?}", document.markdown);

    // Crawl a website
    let options = CrawlOptions {
        limit: Some(50),
        ..Default::default()
    };
    let result = client.crawl("https://docs.firecrawl.dev", options).await?;
    println!("Crawled {} pages", result.data.len());

    // Search the web
    let response = client.search("best web scraping tools 2024", None).await?;
    println!("{:?}", response.data);

    Ok(())
}
```



### Ruby

Install the SDK:

```bash
gem install firecrawl-sdk
```

```ruby
require "firecrawl"

client = Firecrawl::Client.new(api_key: "fc-YOUR_API_KEY")

# Scrape a single URL
doc = client.scrape("https://firecrawl.dev",
  Firecrawl::Models::ScrapeOptions.new(formats: ["markdown"]))
puts doc.markdown

# Use the Agent for autonomous data gathering
result = client.agent(
  Firecrawl::Models::AgentOptions.new(prompt: "Find the founders of Stripe"))
puts result.data

# Crawl a website (automatically waits for completion)
job = client.crawl("https://docs.firecrawl.dev",
  Firecrawl::Models::CrawlOptions.new(limit: 50))
job.data.each { |d| puts d.metadata.source_url }

# Search the web
results = client.search("best AI data tools 2024",
  Firecrawl::Models::SearchOptions.new(limit: 10))
puts results
```



### .NET

Install the SDK:

```bash
dotnet add package firecrawl-sdk
```

```csharp
using Firecrawl;
using Firecrawl.Models;

var client = new FirecrawlClient("fc-YOUR_API_KEY");

// Scrape a single URL
var doc = await client.ScrapeAsync("https://firecrawl.dev",
    new ScrapeOptions { Formats = new List<object> { "markdown" } });
Console.WriteLine(doc.Markdown);

// Crawl a website (automatically waits for completion)
var job = await client.CrawlAsync("https://docs.firecrawl.dev",
    new CrawlOptions { Limit = 50 });
Console.WriteLine($"Crawled {job.Data.Count} pages");

// Search the web
var results = await client.SearchAsync("best AI data tools 2024",
    new SearchOptions { Limit = 10 });
Console.WriteLine(results);
```



### PHP

Install the SDK:

```bash
composer require firecrawl/firecrawl-sdk
```

```php
<?php

use Firecrawl\Client\FirecrawlClient;
use Firecrawl\Models\ScrapeOptions;
use Firecrawl\Models\CrawlOptions;
use Firecrawl\Models\SearchOptions;

$client = FirecrawlClient::create(apiKey: 'fc-YOUR_API_KEY');

// Scrape a single URL
$doc = $client->scrape('https://firecrawl.dev', ScrapeOptions::with(
    formats: ['markdown'],
));
echo $doc->getMarkdown();

// Crawl a website (automatically waits for completion)
$job = $client->crawl('https://docs.firecrawl.dev', CrawlOptions::with(limit: 50));
foreach ($job->getData() as $page) {
    echo $page->getMetadata()['sourceURL'] . "\n";
}

// Search the web
$results = $client->search('best AI data tools 2024', SearchOptions::with(limit: 10));
print_r($results);
```

---



## Integrations

**Agents & AI Tools**

- [Firecrawl Skill](https://docs.firecrawl.dev/sdks/cli)
- [Firecrawl CLI Skills](https://github.com/firecrawl/cli#agent-skills)
- [Firecrawl Workflows](https://github.com/firecrawl/firecrawl-workflows)
- [Firecrawl MCP](https://github.com/mendableai/firecrawl-mcp-server)

**Platforms**

- [Lovable](https://docs.lovable.dev/integrations/firecrawl)
- [Zapier](https://zapier.com/apps/firecrawl/integrations)
- [n8n](https://n8n.io/integrations/firecrawl/)

[View all integrations →](https://www.firecrawl.dev/integrations)

**Missing your favorite tool?** [Open an issue](https://github.com/mendableai/firecrawl/issues) and let us know!

---



## Resources

- [Documentation](https://docs.firecrawl.dev)
- [API Reference](https://docs.firecrawl.dev/api-reference/introduction)
- [Playground](https://firecrawl.dev/playground)
- [Changelog](https://firecrawl.dev/changelog)

---



## Open Source vs Cloud

Firecrawl is open source under the AGPL-3.0 license. The cloud version at [firecrawl.dev](https://firecrawl.dev) includes additional features:

Open Source vs Cloud

To run locally, see the [Contributing Guide](https://github.com/firecrawl/firecrawl/blob/main/CONTRIBUTING.md). To self-host, see [Self-Hosting Guide](https://docs.firecrawl.dev/contributing/self-host).

---



## 本仓库：4GiB 自托管裁剪与链路报告

本 fork 按 **2 核 / 4GiB 内存** 的业务机约束裁剪了官方 Docker 栈，并接上本机 Clash 代理（`host.docker.internal:7897`）与 Obscura 浏览器 sidecar。目标是给 Hermes 一个可直连的 `FIRECRAWL_BASE_URL`，而不是复刻 Firecrawl Cloud 全功能。

- 入口：`http://127.0.0.1:3002`
- 认证：`USE_DB_AUTHENTICATION=false`，**不需要 API Key**
- Hermes：`FIRECRAWL_BASE_URL=http://127.0.0.1:3002`
- 限流：`scrape` / `search` / `map` **合计**每 60 秒最多 50 次（Redis）。超限返回 HTTP 429，`error` 里写明规则和还要等几秒。`SELF_HOSTED_RATE_LIMIT_POINTS` / `SELF_HOSTED_RATE_LIMIT_DURATION` 可改。
- 重启：所有容器 `restart: unless-stopped`（崩了会拉起；你手动 `docker compose stop` 后不会擅自回来）。本机 Docker 走 Colima，登录时由 LaunchAgent `com.firecrawl.colima` 执行一次 `colima start`；引擎起来后带 `unless-stopped` 的容器会跟着起来。出网仍依赖本机 Clash。

容器内存上限合计 **2464 MiB**（api 1536 + playwright 288 + obscura×2 400 + redis 48 + postgres 192）。空闲 + 一次 scrape 实测约 **1.5 GiB**。

### 删了 / 关掉了什么


| 项                                  | 做法                                                    | 原因                                     |
| ---------------------------------- | ----------------------------------------------------- | -------------------------------------- |
| FoundationDB + init                | 从 `docker-compose.yaml` 去掉；队列走 Postgres               | FDB 客户端库体积大、运行时吃内存，4GiB 扛不住            |
| RabbitMQ（含 management）             | 从 compose 去掉                                          | 主要为 extract 队列服务；无 extract-worker 后无必要 |
| extract-worker                     | `HARNESS_SKIP_EXTRACT_WORKER=true`，harness 不拉起该进程     | 常驻 Node 进程，extract 本就不能在无云能力下完整工作      |
| NuQ worker 默认 5 个                  | `NUQ_WORKER_COUNT=1`                                  | 每个 worker 都是独立 Node，内存线性涨              |
| Playwright 镜像内 Chromium            | `INSTALL_CHROMIUM=false`                              | 改由 Obscura 提供浏览器；镜像更小、运行时少一份 Chrome    |
| Playwright 1GiB tmpfs、host 映射 3000 | 去掉                                                    | tmpfs 直接占 RAM；3000 不必对外暴露              |
| API / Playwright 默认大内存限额           | api 1536m、playwright 288m                             | 官方默认按 8G/4G 量级，4GiB 主机必 OOM            |
| Node heap                          | `NODE_OPTIONS=--max-old-space-size=512`               | 限制 api 容器内多个 Node 进程的堆                 |
| Markdown 转换                        | `USE_GO_MARKDOWN_PARSER=true`；HTML 超过约 1.5MB 先截到上一个标签结束再转 | 转换走 Go 解析器，避免大页面在 V8 里建 DOM 把堆撑爆 |
| 并发                                 | `MAX_CONCURRENT_JOBS=4`，`CRAWL_CONCURRENT_REQUESTS=6`，`PLAYWRIGHT_MAX_CONCURRENT_PAGES=1`，两个 Obscura 实例 | 同时最多 4 个作业；每个 Obscura 一次只开 1 个页面（同进程里跳转会让其他页面读不出 HTML）；两个实例可同时接两个 scrape |
| Redis 持久化 / 大缓存                    | `--maxmemory 32mb --save ""`                          | 本机不需要持久队列快照                            |
| Postgres 默认缓冲                      | `shared_buffers=32MB`，`max_connections=40`            | 给 api/浏览器让内存                           |




### 保留了什么


| 项                                          | 作用                                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `api` harness                              | 对外 HTTP；容器内仍起 `api` + `queue-worker` + `nuq-worker-0` + `nuq-prefetch` + `nuq-reconciler` |
| Redis                                      | 限流账本（自托管 scrape/search/map 合计 60 秒 50 次）、crawl 会话、并发键等短状态；extract 本身已关 |
| `nuq-postgres`                             | scrape / crawl / batch 的 NuQ 队列后端                                                         |
| `playwright-service`                       | 把抓取请求转到浏览器引擎                                                                              |
| `obscura` / `obscura-2` sidecar            | 两个独立 CDP 浏览器，Playwright 按空闲轮询分配；经 Clash 出网；`--allow-private-network` 才能连 RFC1918 的宿主机代理 |
| scrape / search / map / batch / crawl 代码路径 | 自托管能跑的核心抓取链路                                                                              |
| Clash 出网                                   | `PROXY_SERVER` + `HTTP(S)_PROXY` + `NODE_USE_ENV_PROXY=1`；构建镜像同样走代理                       |
| OpenAI 兼容 LLM 配置                           | `OPENAI_BASE_URL` + `MODEL_NAME`（给仍走 chat completions 的路径用；**不是** Agent）                  |


未改上游产品语义：没有 fire-engine、没有云端 Index/Exchange、没有 `EXTRACT_V3_BETA_URL`，这些能力本来就不在开源自托管里。

### 删除与缺云账户的影响

**因本仓库裁剪（4GiB）造成：**

- `**POST /v2/extract**`：没有 extract-worker，也没有 RabbitMQ。请求可能入队或报错，**不会跑完**。
- **并发 / 吞吐**：同时只能稳跑约 1 个 scrape 作业；大批量 crawl 会很慢，还可能把 api 堆顶满。
- **无 Chromium 回退**：Obscura 挂了就不能用 Playwright 引擎；fetch 引擎仍在，但 JS 站点会空。
- **无 FDB**：不能切 `NUQ_BACKEND=fdb`。
- **无 Redis 持久化**：重启丢限流/短状态，队列在 Postgres 里。

**因没有 Firecrawl Cloud / fire-engine / 云托管账户（开源自托管本来就没有）：**

- `**POST /v2/agent**`：硬依赖 `EXTRACT_V3_BETA_URL`，实测 `500 Agent beta is not enabled.`
- **截图、actions、Interact、stealth/captcha、品牌提取**：绑定 fire-engine CDP；本地 Playwright 引擎 `screenshot`/`actions` 均为 false
- **Search 质量**：无 Google/fire-engine 搜索。`.env` 填了 `BRAVE_SEARCH_API_KEY` 就走 Brave Search API（`/res/v1/web/search`，经 Clash 代理，按次计费、需信用卡）；留空则走 DuckDuckGo 回退（未配 SearXNG）。Brave 报错不会再退回 DDG
- **Map 完整度**：无云端 Index / fire-engine sitemap 增强。接口能 200，但无 sitemap 的 SPA（如 `open-sandbox.ai`）会返回 `links: []`
- **Browser API、Monitor、Slack、计费/credits、团队威胁防护等**：云控制面，自托管不可用
- **认证 / 多租户**：关掉了 DB auth，只适合本机单用户

**仍可用但降级：**

- Scrape JS 页：Obscura 已开 `--stealth`（指纹；TLS 伪装取决于镜像是否带 stealth 编译特性）。这不是 Cloud 的 enhanced 代理
- JSON 结构化抽取（scrape 的 json format）：不走 extract-worker，理论上可打 OpenAI 兼容接口，**本轮未做冒烟**



### 链路状态（本机实测）


| 链路                                   | 状态       | 说明                                                           |
| ------------------------------------ | -------- | ------------------------------------------------------------ |
| Health `GET /v0/health/readiness`    | 通        | `{"status":"ok"}`                                            |
| Scrape `POST /v2/scrape`             | 通        | `example.com`、`https://opencode.ai/docs/go/`（约 12k markdown） |
| Search `POST /v2/search`             | 通        | 「北京未来 7 天天气预报」，DDG 回退，5 条                                    |
| Map `POST /v2/map`                   | 接口通、结果常空 | `https://open-sandbox.ai/` → `links: []`                     |
| Batch scrape `POST /v2/batch/scrape` | 通        | 首页 200，需再 poll status                                        |
| Crawl `POST /v2/crawl`               | 链路保留     | 与 batch 共用 queue-worker；本轮未做整站遍历                             |
| Agent `POST /v2/agent`               | 不通       | 无云端 Extract v3                                               |
| Extract `POST /v2/extract`           | 不通       | 已关 worker + 无 RabbitMQ                                       |
| Screenshot / actions / interact      | 不通       | 无 fire-engine                                                |
| Browser / Monitor / 云控制面             | 不通       | 需托管账户                                                        |




### 能通链路的 curl（无 Auth）

把栈拉起来后（`docker compose up -d`，API 映射 `3002`）：

**1. Health**

```bash
curl -sS http://127.0.0.1:3002/v0/health/readiness
```

**2. Scrape**

```bash
curl -sS http://127.0.0.1:3002/v2/scrape \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","formats":["markdown"]}'
```

**3. Search**

```bash
curl -sS http://127.0.0.1:3002/v2/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"北京未来7天天气预报","limit":5}'
```

**4. Map（接口通，很多站 links 为空）**

```bash
curl -sS http://127.0.0.1:3002/v2/map \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com"}'
```

**5. Batch scrape**

```bash
# 提交
JOB=$(curl -sS http://127.0.0.1:3002/v2/batch/scrape \
  -H 'Content-Type: application/json' \
  -d '{"urls":["https://example.com"],"formats":["markdown"]}')
echo "$JOB"

# 用返回的 id 查询（把 <id> 换成实际 id）
curl -sS "http://127.0.0.1:3002/v2/batch/scrape/<id>"
```

**6. Crawl（链路保留，未做整站实测）**

```bash
JOB=$(curl -sS http://127.0.0.1:3002/v2/crawl \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","limit":2}')
echo "$JOB"
curl -sS "http://127.0.0.1:3002/v2/crawl/<id>"
```

---



## Contributing

We love contributions! Please read our [Contributing Guide](https://github.com/firecrawl/firecrawl/blob/main/CONTRIBUTING.md) before submitting a pull request.

### Contributors

---



## License

This project is primarily licensed under the GNU Affero General Public License v3.0 (AGPL-3.0). The SDKs and some UI components are licensed under the MIT License. See the LICENSE files in specific directories for details.

---

**It is the sole responsibility of end users to respect websites' policies when scraping.** Users are advised to adhere to applicable privacy policies and terms of use. By default, Firecrawl respects robots.txt directives. By using Firecrawl, you agree to comply with these conditions.

**[↑ Back to Top ↑](#readme-top)**