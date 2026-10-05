# Author Search

`author_search` searches author profiles or finds an author's co-authors.

`GET /content/search/author`

```json
{
  "query": "AUTHLASTNAME(Smith) AND AUTHFIRST(John)",
  "count": 25,
  "sort": "-document-count"
}
```

To find co-authors, supply a Scopus author ID:

```json
{
  "co-author": "7000000001"
}
```

## Parameters

| Parameter          | Description                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `query`            | Native author query. Required unless `co-author` is supplied.                                                      |
| `co-author`        | One numeric Scopus author ID as a string. Takes precedence over `query` when both are supplied.                    |
| `view`             | `STANDARD` (default and only supported view).                                                                      |
| `count`            | Page size, default 25; range 0–200.                                                                                |
| `start`            | Zero-based offset; `start + count` must not exceed 5000.                                                           |
| `field`            | Comma-separated response fields; overrides `view`.                                                                 |
| `sort`             | Up to three comma-separated sort fields with optional `+`/`-` direction prefixes, e.g. `-document-count,+surname`. |
| `facets`           | Facet expression using `af-id`, `affilcity`, `affilcountry`, or `active`.                                          |
| `alias`            | Include superseding author IDs in ID searches; API default `true`.                                                 |
| `suppressNavLinks` | Suppress top-level navigation links; API default `false`.                                                          |
| `reqId`            | Request identifier for Elsevier support.                                                                           |
| `ver`              | Resource flags such as `subjexpand`, `facetexpand`, `allexpand`, or `new`.                                         |

Pagination uses `start` and `count`. Keep the same query or `co-author` and other
options when requesting another page.

## API reference

- [Parameters](https://dev.elsevier.com/documentation/AuthorSearchAPI.wadl)
- [Response views](https://dev.elsevier.com/sc_author_search_views.html)
- [JSON example](https://dev.elsevier.com/payloads/search/authorSearchResp.json)
- [Pagination limits and quotas](https://dev.elsevier.com/api_key_settings.html)
- [Responses and errors](../../README.md#responses-and-errors)
