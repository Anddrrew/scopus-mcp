# Citation Overview

`citation_overview` retrieves yearly citation counts and summaries for specified
publications via `GET /content/abstract/citations`.

```json
{
  "scopus_id": "1000000001,1000000002",
  "date": "2020-2025",
  "citation": "exclude-self"
}
```

## Parameters

Supply exactly one of `scopus_id`, `doi`, `pii`, or `pubmed_id`. Each accepts
a comma-separated string of identifiers. All other parameters are optional.

| Parameter   | Description                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------- |
| `scopus_id` | Scopus document IDs.                                                                         |
| `doi`       | DOIs.                                                                                        |
| `pii`       | Publication item identifiers.                                                                |
| `pubmed_id` | PubMed IDs.                                                                                  |
| `author_id` | Comma-separated author IDs whose citations should be excluded; ignored with `exclude-books`. |
| `date`      | Year or range, such as `2024` or `2020-2025`.                                                |
| `citation`  | `exclude-self` or `exclude-books`; otherwise includes all citations.                         |
| `view`      | `STANDARD`.                                                                                  |
| `start`     | Nonnegative integer result offset; defaults to zero.                                         |
| `count`     | Nonnegative integer result limit; default and maximum depend on service level.               |
| `field`     | Comma-separated response fields.                                                             |
| `sort`      | One field: `sort-year` or `rowTotal`, optionally prefixed with `+` or `-`.                   |
| `reqId`     | Caller-supplied request identifier.                                                          |
| `ver`       | Requested resource version.                                                                  |

## Notes

Elsevier must enable Citation Overview for your API key. A Scopus subscription
alone may not grant this permission.

## API reference

- [Parameters](https://dev.elsevier.com/documentation/AbstractCitationAPI.wadl)
- [JSON example](https://dev.elsevier.com/payloads/metadata/abstractCitationResp.json)
- [Scopus API guide](https://dev.elsevier.com/guides/Scopus%20API%20Guide_V1_20230907.pdf)
- [Responses and errors](../../README.md#responses-and-errors)
