# Scopus Search

`scopus_search` calls `GET https://api.elsevier.com/content/search/scopus` and
returns one page per invocation. Example tool arguments:

```json
{
  "query": "TITLE-ABS-KEY(machine learning) AND PUBYEAR > 2020",
  "view": "STANDARD",
  "count": 25,
  "sort": "-coverDate"
}
```

| Parameter          | Meaning                                                                           |
| ------------------ | --------------------------------------------------------------------------------- |
| `query`            | Required native Scopus query string                                               |
| `view`             | `STANDARD` (default), `COMPLETE`, or `COMPONENT`                                  |
| `count`            | Page size, default 25; max 200 for STANDARD or 25 for COMPLETE/COMPONENT          |
| `start`            | Zero-based offset; the requested window must fit within 5000 results              |
| `cursor`           | Cursor pagination: `*` first, then `search-results.cursor["@next"]`; omit `start` |
| `date`             | Year or range, e.g. `2020-2026`                                                   |
| `sort`             | API sort expression, e.g. `-coverDate,+creator`                                   |
| `field`            | Comma-separated response fields; overrides `view`                                 |
| `subj`             | Subject area code, e.g. `COMP`                                                    |
| `facets`           | API facet expression, e.g. `pubyear;subjarea(count=10,sort=fd)`                   |
| `content`          | `all`, `core`, or `dummy`                                                         |
| `alias`            | Include superseded author profiles in author-ID searches                          |
| `suppressNavLinks` | Suppress top-level navigation links                                               |
| `reqId`            | Request identifier for Elsevier support                                           |
| `ver`              | Resource-version flags such as `new` or `facetexpand`                             |

Keep the same query and options when requesting the next page. Navigation links
and cursor tokens are preserved as returned by Elsevier; the tool does not
automatically fetch additional pages. View/cursor access depends on your API
key and institutional entitlements. With `field`, Elsevier decides the effective
view and limit. The tool always requests JSON.

## API reference

- [Parameters](https://dev.elsevier.com/documentation/SCOPUSSearchAPI.wadl)
- [Response views](https://dev.elsevier.com/sc_search_views.html)

See the [README](../../README.md#responses-and-errors) for the shared response
and error contract.
