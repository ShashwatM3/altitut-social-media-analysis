# ALTITUT Platform Cost Analysis

As of 2026-06-01

## Scope

This estimate covers the two product runs in the app:

1. Competitor Scout
2. Posts Analysis

The platform currently uses three paid vendors:

- OpenAI GPT-4o mini via the Responses / Chat Completions APIs
- Exa search API
- Apify actor runs

This report uses official vendor pricing pages plus live API/account checks against the current environment.

---

## 1) Official pricing used

### OpenAI

Source: OpenAI Developers pricing page and GPT-4o mini model page.

Relevant prices:

- GPT-4o mini: $0.15 / 1M input tokens
- GPT-4o mini cached input: $0.075 / 1M tokens
- GPT-4o mini output: $0.60 / 1M tokens
- Web search tool: $10 / 1k calls
- Search content tokens are billed at model rates

Notes:

- The app uses `gpt-4o-mini`.
- The competitor scout path uses the Responses API with `web_search` enabled, so the web search tool call charge applies in addition to token usage.

### Exa

Source: Exa pricing page.

Relevant prices:

- Deep Search: $12 / 1k requests, up to 10 results
- Cost per additional result above 10: $1 / 1k requests
- AI page summaries: $1 / 1k pages

Notes:

- The current competitor scout connector uses Deep Search with `numResults = 10`, so the base Deep Search price is the relevant one.

### Apify

Source: Apify pricing page and live `/v2/users/me` API response.

Relevant prices / plan data:

- Free plan monthly usage credits: $5
- Actor compute units: $0.20 per CU
- Current account plan: Free
- Current month usage credit cap: $5

Live account usage check:

- June 2026 Apify usage seen from recent actor runs: $0.2778
- Approximate remaining monthly credits: $4.7222

---

## 2) Live usage checks

### OpenAI usage check

I could query the OpenAI API with the current secret key, but:

- `/v1/dashboard/billing/credit_grants` returned 403 because that endpoint requires a browser session key
- `/v1/organization/costs` returned 403 because the current key does not have `api.usage.read`
- `/v1/usage?date=2026-06-01` returned an empty list for that date

So there is no usable balance endpoint exposed to this secret key in the current environment.

### Apify usage check

The Apify account API returned:

- plan = Free
- monthlyUsageCreditsUsd = 5
- maxMonthlyUsageUsd = 5
- planPricing.ACTOR_COMPUTE_UNITS = 0.2

Recent actor run history shows:

- 2026-06 monthly actor-run spend so far: $0.2778
- remaining free-plan usage budget: about $4.7222

### Exa usage check

Exa responses include per-request `costDollars` in the raw API response. There is no separate balance value surfaced in the live responses I checked.

---

## 3) Actual observed per-run costs

### A. Competitor Scout

Current flow:

- 1 OpenAI Responses request with web search enabled
- 1 Exa Deep Search request

Observed live run data:

- OpenAI usage: 8,824 input tokens, 520 output tokens
- Exa raw response cost: $0.012 total
- One OpenAI web search tool call

OpenAI model cost calculation:

- Input: 8,824 × $0.15 / 1,000,000 = $0.0013236
- Output: 520 × $0.60 / 1,000,000 = $0.0003120
- Model total: $0.0016356
- Web search call: $0.0100

Competitor Scout total:

- OpenAI model + tool: $0.0116356
- Exa: $0.0120
- Total: $0.0236356 per scout run

Rounded:

- About $0.024 per Competitor Scout run

### B. Posts Analysis

Current flow:

- 1 Apify actor run per approved competitor target
- 1 OpenAI analysis call per returned post

Observed live run data:

- 3 Apify runs
- 18 posts analyzed
- Apify run cost per actor run: $0.0026
- Sample OpenAI post-analysis call usage: 738 input tokens, 220 output tokens

Apify total:

- 3 × $0.0026 = $0.0078

OpenAI per-post cost:

- Input: 738 × $0.15 / 1,000,000 = $0.0001107
- Output: 220 × $0.60 / 1,000,000 = $0.0001320
- Per post: $0.0002427

OpenAI total for 18 posts:

- 18 × $0.0002427 = $0.0043686

Posts Analysis total:

- Apify: $0.0078
- OpenAI: $0.0043686
- Total: $0.0121686 per posts-analysis run

Rounded:

- About $0.0122 per Posts Analysis run for the observed 18-post run

---

## 4) Practical cost summary


| Tool             | Main paid vendor spend                  | Typical observed run cost |
| ---------------- | --------------------------------------- | ------------------------- |
| Competitor Scout | OpenAI web search + Exa Deep Search     | ~$0.024                   |
| Posts Analysis   | Apify actor runs + OpenAI post analysis | ~$0.0122                  |


---

## 5) Notes / caveats

- The Competitor Scout estimate is based on the latest live run’s exact token usage and Exa `costDollars` field.
- The Posts Analysis estimate uses a representative live post-analysis call for OpenAI token usage, multiplied by the observed 18-post run size.
- Actual Posts Analysis cost will move with post count and post length.
- Exa and OpenAI may vary slightly run to run if the prompts or result counts change.
- OpenAI balance is not directly accessible from the current secret key; the org billing endpoint requires a browser-session key or broader usage scope.
- Apify cost is the easiest to monitor directly from run history because each actor run returns `usageTotalUsd`.

---

## 6) Bottom line

If the platform is used at the current observed sizes, the operating cost is very low:

- Competitor Scout: about 2.4 cents per run
- Posts Analysis: about 1.2 cents per run

The Apify free plan still has roughly $4.72 in monthly usage credits left, based on the current account data and June usage seen so far.