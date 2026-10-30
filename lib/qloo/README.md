# Qloo provider boundary

`QlooClient` implements the shared `TasteProvider` interface. All data has
`source: "qloo"`. A live failure never turns into fixture evidence.

```ts
const provider = new QlooClient({ apiKey: process.env.QLOO_API_KEY! });
const choices = await provider.search("Arrival", "movie");
const evidence = await provider.rank(member, availableOffers);
```

Keep this provider on the server. It accepts only the official hackathon and
production API origins, blocks redirects, and places the key in `X-Api-Key`.
Each operation makes at most two requests. Only 429 and 5xx are retried, with
`Retry-After` capped at two seconds. Calls are spaced 260 milliseconds apart
within a provider instance. The transport allows at most 16 queued requests,
enforces a response-size limit, and times out both headers and body reading.
The application still needs its own durable room and public-request budgets.

Search returns choices for explicit identity selection. It does not silently
pick the first match. Ranking requests one finite set of unique work identities
for one reader. Each physical copy keeps its own offer ID. Self-owned and
unavailable offers are excluded before the request. Copies of the same work
receive the same returned rank; missing books stay unknown. Scores are retained
as raw provider values and never normalized or compared between readers.

The initial explanation field is `null`. Qloo documents `query.explainability`
and its warning, but the public reference does not specify its nested seed
contribution schema. The adapter therefore preserves safe warning text without
inventing a personal attribution. A live response is required before adding
a more detailed parser. Tests use invented IDs and payloads.

Contracts checked on October 30, 2026 against Qloo's official documentation:

- [Search parameters](https://github.com/qloo/docs-public/blob/main/reference/get-search.md)
- [Book parameters](https://github.com/qloo/docs-public/blob/main/reference/available-parameters-by-entity-type.md#book)
- [Insights request and response](https://github.com/qloo/docs-public/blob/main/reference/basic-insights-use-case.md)
- [Explainability and sorting](https://github.com/qloo/docs-public/blob/main/reference/insights-api-deep-dive.md)
- [Interpreting affinity](https://github.com/qloo/docs-public/blob/main/docs/interpreting-affinity-scores.md)

This documentation review and mocked contract suite do not establish that a
deployed key or a live API run works.
