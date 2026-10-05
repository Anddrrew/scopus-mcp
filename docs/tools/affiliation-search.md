# Affiliation Search

`affiliation_search` calls `GET https://api.elsevier.com/content/search/affiliation`
and returns one page of institution profiles as native Elsevier JSON.

```json
{
  "query": "AFFIL(university) AND AFFIL(London)",
  "count": 25,
  "sort": "-document-count"
}
```

| Parameter          | Meaning                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| `query`            | Required native affiliation query.                                                                          |
| `view`             | `STANDARD` (default and only supported view).                                                               |
| `count`            | Page size, default 25; range 0–200.                                                                         |
| `start`            | Zero-based offset. `start + count` must not exceed 5000.                                                    |
| `field`            | Comma-separated response fields; overrides `view`.                                                          |
| `sort`             | Up to three sort fields with optional `+`/`-` direction prefixes, e.g. `-document-count,+affiliation-name`. |
| `facets`           | Native facet expression. Available facets: `affilcity`, `affilcountry`.                                     |
| `suppressNavLinks` | Suppress top-level navigation links; Elsevier defaults to `false`.                                          |
| `reqId`            | Request identifier for Elsevier support.                                                                    |
| `ver`              | Resource flags such as `facetexpand`, `allexpand`, or `new`.                                                |

Pagination uses `start` and `count`; this API does not document cursor pagination.
Keep the same query and other options when requesting another page. The tool
makes one request, always asks for JSON, and does not follow navigation links.

The native `search-results` object includes an `entry` array, string-valued
OpenSearch counts, names and name variants, identifiers, document counts, cities,
and countries when available. Empty results, nulls, unknown fields, and fields
omitted by `field` selection are preserved. Responses and errors follow the
[common contract](../../README.md#responses-and-errors).

## Elsevier references

- [API parameters](https://dev.elsevier.com/documentation/AffiliationSearchAPI.wadl)
- [Query syntax](https://dev.elsevier.com/sc_affil_search_tips.html)
- [Response view](https://dev.elsevier.com/sc_affil_search_views.html)
- [JSON example](https://dev.elsevier.com/payloads/search/affiliationSearchResp.json)
- [Pagination limits and quotas](https://dev.elsevier.com/api_key_settings.html)
