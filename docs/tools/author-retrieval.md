# Author Retrieval

`author_retrieval` retrieves Scopus author profiles through these endpoints:

- `GET /content/author/author_id/{author_id}`
- `GET /content/author/eid/{eid}`
- `GET /content/author/orcid/{orcid}`
- `GET /content/author` for comma-separated `author_id` or `eid` values

Provide exactly one identifier parameter. For a single profile:

```json
{
  "author_id": "7202909704",
  "view": "ENHANCED"
}
```

For multiple profiles:

```json
{
  "author_id": "7202909704,35227147500",
  "view": "LIGHT"
}
```

## Parameters

| Parameter   | Description                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------- |
| `author_id` | One Scopus author ID, or comma-separated IDs                                                  |
| `eid`       | One author EID, or comma-separated EIDs                                                       |
| `orcid`     | One ORCID; returns a Scopus author profile                                                    |
| `view`      | `BASIC`, `LIGHT` (API default), `STANDARD`, `ENHANCED`, `METRICS`, `DOCUMENTS`, or `ENTITLED` |
| `field`     | Comma-separated response fields                                                               |
| `alias`     | Single profile only; API default `true`. Set `false` to request a superseded profile          |
| `startref`  | Single profile only; nonnegative integer offset for related documents                         |
| `refcount`  | Single profile only; nonnegative integer number of related documents                          |
| `reqId`     | Request identifier for Elsevier support                                                       |
| `ver`       | Resource version                                                                              |

## Notes

Batch requests do not support `DOCUMENTS`, `alias`, `startref`, or `refcount`.
View access and result limits depend on your API service level.

Batch results use `author-retrieval-response-list`. Inspect each profile's
`@status`: HTTP success does not mean every requested author was found.

Superseded profiles can return replacement errors such as `HTTP_301`. Redirects
are not followed. Use the current author identifier, or `alias: false` to request
the original profile.

## API reference

- [Parameters and endpoints](https://dev.elsevier.com/documentation/AuthorRetrievalAPI.wadl)
- [Response views](https://dev.elsevier.com/sc_author_retrieval_views.html)
- [Responses and errors](../../README.md#responses-and-errors)
