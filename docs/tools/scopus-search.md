# Scopus Search

`scopus_search` searches publications using Scopus query syntax.

`GET /content/search/scopus`

```json
{
  "query": "TITLE-ABS-KEY(machine learning) AND PUBYEAR > 2020",
  "view": "STANDARD",
  "count": 25,
  "sort": "-coverDate"
}
```

## Parameters

| Parameter          | Description                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `query`            | Required native Scopus query.                                                                                 |
| `view`             | `STANDARD` (default), `COMPLETE`, or `COMPONENT`.                                                             |
| `count`            | Page size, default 25. Range 0–200 for `STANDARD`, or 0–25 for `COMPLETE`/`COMPONENT`.                        |
| `start`            | Zero-based offset; `start + count` must not exceed 5000. Use instead of `cursor`.                             |
| `cursor`           | `*` for the first page, then `search-results.cursor["@next"]`. Use instead of `start`.                        |
| `date`             | Year or range, e.g. `2020-2026`.                                                                              |
| `sort`             | Up to three comma-separated sort fields with optional `+`/`-` direction prefixes, e.g. `-coverDate,+creator`. |
| `field`            | Comma-separated response fields; overrides `view`.                                                            |
| `subj`             | Subject area code, e.g. `COMP`.                                                                               |
| `facets`           | Facet expression, e.g. `pubyear;subjarea(count=10,sort=fd)`.                                                  |
| `content`          | `all`, `core`, or `dummy`.                                                                                    |
| `alias`            | Include superseded author profiles in author-ID searches; API default `true`.                                 |
| `suppressNavLinks` | Suppress top-level navigation links; API default `false`.                                                     |
| `reqId`            | Request identifier for Elsevier support.                                                                      |
| `ver`              | Resource flags such as `facetexpand`, `allexpand`, or `new`.                                                  |

Keep the same query and options when requesting another page. Cursor pagination
supports searches beyond the 5000-result offset limit. Access to views and cursor
pagination depends on your Scopus entitlements. With `field`, Elsevier determines
the effective view and result limit.

## API reference

- [Parameters](https://dev.elsevier.com/documentation/SCOPUSSearchAPI.wadl)
- [Response views](https://dev.elsevier.com/sc_search_views.html)
- [Responses and errors](../../README.md#responses-and-errors)
