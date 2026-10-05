# Affiliation Search

`affiliation_search` searches institution profiles using affiliation query syntax.

`GET /content/search/affiliation`

```json
{
  "query": "AFFIL(university) AND AFFIL(London)",
  "count": 25,
  "sort": "-document-count"
}
```

## Parameters

| Parameter          | Description                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `query`            | Required native affiliation query.                                                                                          |
| `view`             | `STANDARD` (default and only supported view).                                                                               |
| `count`            | Page size, default 25; range 0–200.                                                                                         |
| `start`            | Zero-based offset; `start + count` must not exceed 5000.                                                                    |
| `field`            | Comma-separated response fields; overrides `view`.                                                                          |
| `sort`             | Up to three comma-separated sort fields with optional `+`/`-` direction prefixes, e.g. `-document-count,+affiliation-name`. |
| `facets`           | Facet expression using `affilcity` or `affilcountry`.                                                                       |
| `suppressNavLinks` | Suppress top-level navigation links; API default `false`.                                                                   |
| `reqId`            | Request identifier for Elsevier support.                                                                                    |
| `ver`              | Resource flags such as `facetexpand`, `allexpand`, or `new`.                                                                |

Pagination uses `start` and `count`. Keep the same query and other options when
requesting another page.

## API reference

- [Parameters](https://dev.elsevier.com/documentation/AffiliationSearchAPI.wadl)
- [Query syntax](https://dev.elsevier.com/sc_affil_search_tips.html)
- [Response views](https://dev.elsevier.com/sc_affil_search_views.html)
- [JSON example](https://dev.elsevier.com/payloads/search/affiliationSearchResp.json)
- [Pagination limits and quotas](https://dev.elsevier.com/api_key_settings.html)
- [Responses and errors](../../README.md#responses-and-errors)
