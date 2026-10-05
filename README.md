# scopus-mcp

[![npm version](https://img.shields.io/npm/v/scopus-mcp)](https://www.npmjs.com/package/scopus-mcp)
[![Node.js](https://img.shields.io/node/v/scopus-mcp)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Connect MCP clients to the Elsevier Scopus API. This TypeScript server runs over
stdio and exposes API operations as tools, preserving Elsevier's parameter
names and JSON responses.

Each tool invocation makes one API request. Tools declare an `outputSchema`
and return MCP `structuredContent` with a JSON text fallback.

## Quick start

You need Node.js **22.22.0 or newer**, npm, an MCP client with stdio support,
and an API key from the [Elsevier Developer Portal](https://dev.elsevier.com/).
Node.js 24 is used in CI. Available data and views depend on your Elsevier
subscription and institutional access.

Add this server to your MCP client's configuration:

```json
{
  "mcpServers": {
    "scopus": {
      "command": "npx",
      "args": ["-y", "scopus-mcp"],
      "env": {
        "ELSEVIER_API_KEY": "your-elsevier-api-key"
      }
    }
  }
}
```

The location of this configuration depends on your client. Restart or reload the
client after saving it. For reproducible deployments, replace `scopus-mcp` in
`args` with `scopus-mcp@<version>`.

Try asking your client: “Find recent Scopus papers about machine learning.”

Running `npx -y scopus-mcp` in a terminal starts the same server. It waits for MCP
messages on stdin; it does not provide an interactive prompt or an HTTP server.

## Configuration

| Environment variable  | Purpose                                                                      |
| --------------------- | ---------------------------------------------------------------------------- |
| `ELSEVIER_API_KEY`    | Required to call API tools. Obtain a key from the Elsevier Developer Portal. |
| `ELSEVIER_INST_TOKEN` | Optional institutional token, if provided by your institution.               |

Add the institutional token alongside the API key in the client's `env` object
when needed. Credentials are sent in HTTP headers and are never tool arguments.
Environment files such as `.env` are not loaded automatically.

The server can start and list tools without credentials. Calling an API tool
without a key returns `MISSING_API_KEY`.

## Available tools

| Tool                    | Description                                                                  | Reference                                                    |
| ----------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `scopus_search`         | Search Scopus publications using native query syntax and pagination.         | [Scopus Search](docs/tools/scopus-search.md)                 |
| `author_search`         | Search author profiles or find co-authors.                                   | [Author Search](docs/tools/author-search.md)                 |
| `affiliation_search`    | Search institution profiles with native query syntax.                        | [Affiliation Search](docs/tools/affiliation-search.md)       |
| `author_retrieval`      | Retrieve one or multiple Scopus author profiles by author ID, EID, or ORCID. | [Author Retrieval](docs/tools/author-retrieval.md)           |
| `affiliation_retrieval` | Retrieve a Scopus institution profile by affiliation ID or EID.              | [Affiliation Retrieval](docs/tools/affiliation-retrieval.md) |
| `plumx_metrics`         | Retrieve publication metrics by DOI or another supported identifier.         | [PlumX Metrics](docs/tools/plumx-metrics.md)                 |
| `citation_overview`     | Retrieve yearly citation counts and summaries for specified publications.    | [Citation Overview](docs/tools/citation-overview.md)         |

This table describes the checked-out revision. Use the README from your installed
version's Git tag when working with an older npm release.

For example, call `scopus_search` with:

```json
{
  "query": "TITLE-ABS-KEY(machine learning) AND PUBYEAR > 2020",
  "view": "STANDARD",
  "count": 25,
  "sort": "-coverDate"
}
```

Tools return one response at a time. Use the API's pagination parameters to
request subsequent pages; the server does not automatically follow links or
combine results.

## Responses and errors

Successful responses preserve the native Elsevier JSON, including namespaced
keys such as `dc:title`, string counts, `null` values, and unknown fields. Fields
omitted by the API remain absent. The same JSON is exposed in
`structuredContent` and serialized in a text content block.

Available quota headers are returned separately in
`_meta["scopus-mcp/headers"]`: `X-RateLimit-Limit`, `X-RateLimit-Remaining`,
`X-RateLimit-Reset`, and `Retry-After`. Header values remain strings.

API failures return `isError: true` and a JSON text error with `code`, `message`,
and `status` when an HTTP status is available. Invalid arguments are rejected
before an API request. Requests support cancellation, time out after 30 seconds,
and are not retried automatically.

| Problem                      | What to check                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `MISSING_API_KEY`            | Set `ELSEVIER_API_KEY` in the MCP server's environment.                                                                        |
| HTTP 401 or 403              | Check your key, subscription, institutional network, and institutional token. A key alone does not grant access to every view. |
| HTTP 429                     | Inspect quota headers and `Retry-After` before retrying.                                                                       |
| `TIMEOUT` or `NETWORK_ERROR` | Check connectivity to `api.elsevier.com`, then retry if appropriate.                                                           |
| `INVALID_RESPONSE`           | The upstream response was not valid JSON or did not match the tool's expected response shape.                                  |

Elsevier error messages are retained with credentials redacted. Non-JSON HTTP
errors use a status-based message. Stdout is reserved for MCP messages;
diagnostics go to stderr.

## Development and contributing

```sh
git clone https://github.com/Anddrrew/scopus-mcp.git
cd scopus-mcp
npm ci
npm run check
```

Tests run offline with synthetic API responses and do not require an API key.
See [CONTRIBUTING.md](CONTRIBUTING.md) for the project layout, local MCP setup,
and guidelines for adding tools. Bug reports and focused pull requests are
welcome through [GitHub](https://github.com/Anddrrew/scopus-mcp/issues).

Maintainers can find publishing and versioning instructions in the
[release guide](docs/releases.md).

## API documentation

- [Scopus API specification](https://dev.elsevier.com/sc_api_spec.html)
- [Interactive API documentation](https://dev.elsevier.com/scopus.html)
- [API limits and quota headers](https://dev.elsevier.com/api_key_settings.html)

## License

[MIT](LICENSE) © 2026 Andrii Baran.

This is an independent project and is not affiliated with or endorsed by Elsevier.
The MIT license covers this project's code. Access to Elsevier APIs and use of
Scopus data are governed by Elsevier's terms.
