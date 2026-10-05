# Citation Overview

`citation_overview` retrieves citation counts by year and citation summaries with
one GET request to `/content/abstract/citations`. It preserves Elsevier's
`abstract-citations-response` JSON, including native nested matrix fields and
string counts.

```json
{
  "scopus_id": "1000000001,1000000002",
  "date": "2020-2025",
  "citation": "exclude-self"
}
```

The identifiers above are illustrative. Supply exactly one of `scopus_id`,
`doi`, `pii`, or `pubmed_id`; each accepts a comma-separated list. The endpoint
handles multiple documents in the same request.

| Parameter   | Type    | Description                                                                                  |
| ----------- | ------- | -------------------------------------------------------------------------------------------- |
| `scopus_id` | string  | One or more Scopus document IDs.                                                             |
| `doi`       | string  | One or more DOIs.                                                                            |
| `pii`       | string  | One or more publication item identifiers.                                                    |
| `pubmed_id` | string  | One or more PubMed IDs.                                                                      |
| `author_id` | string  | Comma-separated author IDs whose citations should be excluded; ignored with `exclude-books`. |
| `date`      | string  | Year or range, such as `2024` or `2020-2025`.                                                |
| `citation`  | string  | `exclude-self` or `exclude-books`; Elsevier otherwise includes all citations.                |
| `view`      | string  | `STANDARD`, the only documented view.                                                        |
| `start`     | integer | Nonnegative result offset; API default is zero.                                              |
| `count`     | integer | Nonnegative requested result limit; defaults and maximum depend on service level.            |
| `field`     | string  | Comma-separated response fields.                                                             |
| `sort`      | string  | `sort-year` or `rowTotal`, optionally prefixed with `+` or `-`. One field only.              |
| `reqId`     | string  | Caller-supplied request identifier.                                                          |
| `ver`       | string  | Requested resource version.                                                                  |

Optional parameters are passed only when supplied. Pagination is explicit; one
invocation never fetches additional pages. The output schema describes the native
identifier legend, document citation matrix, and column totals while allowing
unknown fields, partial field selections, and null values. No totals are
recalculated and singleton objects are not converted to arrays.

Citation Overview is access-controlled: Elsevier must enable it for your API key.
A Scopus subscription alone may not grant this permission. Errors and quota
headers follow the [common response contract](../../README.md#responses-and-errors).

References:

- [Citation Overview API parameters](https://dev.elsevier.com/documentation/AbstractCitationAPI.wadl)
- [Official JSON example](https://dev.elsevier.com/payloads/metadata/abstractCitationResp.json)
- [Scopus API guide](https://dev.elsevier.com/guides/Scopus%20API%20Guide_V1_20230907.pdf) (access on page 9, overview on pages 31–32, identifiers on pages 50–52)
