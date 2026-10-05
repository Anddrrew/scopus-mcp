# Affiliation Retrieval

`affiliation_retrieval` retrieves a Scopus institution profile through:

- `GET /content/affiliation/affiliation_id/{affiliation_id}`
- `GET /content/affiliation/eid/{eid}`

Provide exactly one of `affiliation_id` or `eid`; identifier lists are not
supported. For a profile:

```json
{
  "affiliation_id": "60016849",
  "view": "STANDARD"
}
```

For related authors:

```json
{
  "affiliation_id": "60016849",
  "view": "AUTHORS",
  "startref": 0,
  "refcount": 25
}
```

## Parameters

| Parameter        | Description                                                                       |
| ---------------- | --------------------------------------------------------------------------------- |
| `affiliation_id` | One Scopus affiliation ID                                                         |
| `eid`            | One affiliation EID; alternative to `affiliation_id`                              |
| `view`           | `BASIC`, `LIGHT` (API default), `STANDARD`, `DOCUMENTS`, `AUTHORS`, or `ENTITLED` |
| `field`          | Comma-separated fields; cannot be used with `DOCUMENTS` or `AUTHORS`              |
| `startref`       | Nonnegative integer offset for related documents or authors                       |
| `refcount`       | Nonnegative integer number of related documents or authors                        |
| `reqId`          | Request identifier for Elsevier support                                           |
| `ver`            | Resource version                                                                  |

Use `DOCUMENTS` or `AUTHORS` to request related records, with `startref` and
`refcount` for pagination. View access and result limits depend on your API
service level.

## API reference

- [Parameters and endpoints](https://dev.elsevier.com/documentation/AffiliationRetrievalAPI.wadl)
- [Response views](https://dev.elsevier.com/sc_affil_retrieval_views.html)
- [Responses and errors](../../README.md#responses-and-errors)
