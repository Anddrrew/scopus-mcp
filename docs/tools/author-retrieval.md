# Author Retrieval

`author_retrieval` retrieves Scopus author profiles in one API request. Example:

```json
{
  "author_id": "7202909704",
  "view": "ENHANCED"
}
```

Provide exactly one identifier parameter. A single `author_id`, `eid`, or `orcid`
uses `GET /content/author/{identifier-name}/{identifier}`. Comma-separated
`author_id` or `eid` values use `GET /content/author` with the original query
parameter, returning Elsevier's native batch response:

```json
{
  "author_id": "7202909704,35227147500",
  "view": "LIGHT"
}
```

| Parameter   | Meaning                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------- |
| `author_id` | One Scopus author ID, or comma-separated IDs                                                    |
| `eid`       | One author EID, or comma-separated EIDs                                                         |
| `orcid`     | One ORCID; returns the normal Scopus author profile                                             |
| `view`      | `BASIC`, `LIGHT` (API default), `STANDARD`, `ENHANCED`, `METRICS`, `DOCUMENTS`, or `ENTITLED`   |
| `field`     | Comma-separated response fields                                                                 |
| `alias`     | Single profile only; API default `true`. Set `false` to request the original superseded profile |
| `startref`  | Single profile only; zero-based offset for related documents                                    |
| `refcount`  | Single profile only; number of related documents                                                |
| `reqId`     | Request identifier for Elsevier support                                                         |
| `ver`       | Resource version                                                                                |

`DOCUMENTS`, `alias`, `startref`, and `refcount` are unavailable for batch requests.
The API determines view access and result limits. `BASIC` is included because it
is documented in the response-view chart, although omitted from the WADL enum.
The tool always requests `application/json`; ORCID export views and alternative
ORCID response formats are outside this tool's scope.

The native `author-retrieval-response` and `author-retrieval-response-list`
envelopes are retained. Profiles can be objects or arrays; partial profiles,
nulls, string counts, and additional fields remain unchanged. A batch may contain
per-profile statuses: inspect them instead of treating HTTP success as proof that
every requested author was found.

Elsevier can redirect superseded profiles. The shared HTTP client does not
follow redirects, so these can produce `NETWORK_ERROR`. Use the current author
identifier, or `alias: false` to request the original profile. No replacement
profiles or additional pages are fetched automatically.

## API reference

- [Parameters and endpoints](https://dev.elsevier.com/documentation/AuthorRetrievalAPI.wadl)
- [Response views](https://dev.elsevier.com/sc_author_retrieval_views.html)

See the [README](../../README.md#responses-and-errors) for the shared response
and error contract.
