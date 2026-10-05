# Author Search

`author_search` calls `GET https://api.elsevier.com/content/search/author`
and returns one page of native Elsevier JSON.

```json
{
  "query": "AUTHLASTNAME(Smith) AND AUTHFIRST(John)",
  "count": 25,
  "sort": "-document-count"
}
```

To find an author's co-authors, pass a single Scopus author ID:

```json
{
  "co-author": "7000000001"
}
```

| Parameter          | Meaning                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| `query`            | Native author query. Required unless `co-author` is supplied.                                           |
| `co-author`        | One numeric Scopus author ID, represented as a string. Elsevier ignores `query` when both are supplied. |
| `view`             | `STANDARD` (default and only supported view).                                                           |
| `count`            | Page size, default 25; range 0–200.                                                                     |
| `start`            | Zero-based offset. `start + count` must not exceed 5000.                                                |
| `field`            | Comma-separated response fields; overrides `view`.                                                      |
| `sort`             | Up to three sort fields with optional `+`/`-` direction prefixes, e.g. `-document-count,+surname`.      |
| `facets`           | Native facet expression. Available facets: `af-id`, `affilcity`, `affilcountry`, `active`.              |
| `alias`            | Include superseding author IDs in ID searches; Elsevier defaults to `true`.                             |
| `suppressNavLinks` | Suppress top-level navigation links; Elsevier defaults to `false`.                                      |
| `reqId`            | Request identifier for Elsevier support.                                                                |
| `ver`              | Resource flags such as `subjexpand`, `facetexpand`, `allexpand`, or `new`.                              |

Pagination uses `start` and `count`; this API does not document cursor pagination.
Keep the same query and other options when requesting another page. The tool
makes one request, always asks for JSON, and does not follow navigation links.

The native `search-results` object includes an `entry` array, string-valued
OpenSearch counts, names, identifiers, current affiliations, and subject data
when available. Empty results, nulls, unknown fields, and fields omitted by
`field` selection are preserved. Responses and errors follow the
[common contract](../../README.md#responses-and-errors).

## Elsevier references

- [API parameters](https://dev.elsevier.com/documentation/AuthorSearchAPI.wadl)
- [Response view](https://dev.elsevier.com/sc_author_search_views.html)
- [JSON example](https://dev.elsevier.com/payloads/search/authorSearchResp.json)
- [Pagination limits and quotas](https://dev.elsevier.com/api_key_settings.html)
