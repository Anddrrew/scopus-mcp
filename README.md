# scopus-mcp

[![npm version](https://img.shields.io/npm/v/scopus-mcp)](https://www.npmjs.com/package/scopus-mcp)
[![Node.js](https://img.shields.io/node/v/scopus-mcp)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An MCP server for the Elsevier Scopus API. Runs over stdio with `npx` and keeps
the API's parameter names and JSON responses.

## Quick start

Requires Node.js **22.22.0 or newer**, npm, and an MCP client with stdio support.
Get an API key from the [Elsevier Developer Portal](https://dev.elsevier.com/)
and add this server to your client's configuration:

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

Reload the client to connect. To pin a release, use `scopus-mcp@<version>` in `args`.

## Configuration

| Environment variable  | Description                                              |
| --------------------- | -------------------------------------------------------- |
| `ELSEVIER_API_KEY`    | Required for all tools except `subject_classifications`. |
| `ELSEVIER_INST_TOKEN` | Institutional token, if provided by your institution.    |

Set credentials in the client's `env` object. The server does not load `.env`
files. Access to data and views depends on your Elsevier subscription and
institutional access.

The server reports its version in MCP `serverInfo` and the startup log on `stderr`.

## Tools

| Tool                                                             | Description                               |
| ---------------------------------------------------------------- | ----------------------------------------- |
| [scopus_search](docs/tools/scopus-search.md)                     | Find publications.                        |
| [author_search](docs/tools/author-search.md)                     | Find authors and co-authors.              |
| [affiliation_search](docs/tools/affiliation-search.md)           | Find institutions.                        |
| [author_retrieval](docs/tools/author-retrieval.md)               | Get author profiles by ID, EID, or ORCID. |
| [affiliation_retrieval](docs/tools/affiliation-retrieval.md)     | Get an institution profile by ID or EID.  |
| [citation_overview](docs/tools/citation-overview.md)             | Get yearly citation counts and summaries. |
| [plumx_metrics](docs/tools/plumx-metrics.md)                     | Get publication metrics by identifier.    |
| [subject_classifications](docs/tools/subject-classifications.md) | Look up subject codes; no API key needed. |

Each call makes one API request. For additional pages, use the tool's pagination
parameters. Requests support cancellation and a 30-second timeout; retries and
redirects are not automatic.

## Responses and errors

Results follow each tool's `outputSchema`. The original API JSON is returned in
both `structuredContent` and a text content block, without reshaping fields or
converting values.

Available quota headers are returned as strings in `_meta["scopus-mcp/headers"]`:
`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After`.

API failures return `isError: true` and a JSON text error with `code`, `message`,
and, when available, an HTTP `status`. Credentials are redacted. Invalid arguments
are rejected before an API request.

| Error                        | What to check                                                   |
| ---------------------------- | --------------------------------------------------------------- |
| `MISSING_API_KEY`            | Set `ELSEVIER_API_KEY` in the server's environment.             |
| HTTP 401 or 403              | Check your key, subscription, institutional network, and token. |
| HTTP 429                     | Check quota headers and `Retry-After` before retrying.          |
| `TIMEOUT` or `NETWORK_ERROR` | Check connectivity to `api.elsevier.com`.                       |
| `INVALID_RESPONSE`           | Elsevier returned invalid JSON or an unexpected response shape. |

## API documentation

- [Scopus API specification](https://dev.elsevier.com/sc_api_spec.html)
- [Interactive API documentation](https://dev.elsevier.com/scopus.html)
- [API limits and quotas](https://dev.elsevier.com/api_key_settings.html)

## Development

See [Contributing](CONTRIBUTING.md) for local setup and changes, and
[Releases](docs/releases.md) for publishing.

## License

[MIT](LICENSE) © 2026 Andrii Baran. Independent project, not affiliated with Elsevier.
