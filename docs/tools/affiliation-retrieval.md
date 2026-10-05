# Affiliation Retrieval

`affiliation_retrieval` retrieves one Scopus institution profile. Example:

```json
{
  "affiliation_id": "60016849",
  "view": "STANDARD"
}
```

Provide exactly one of `affiliation_id` or `eid`. The tool makes one GET request
to `/content/affiliation/affiliation_id/{affiliation_id}` or
`/content/affiliation/eid/{eid}` and returns the original JSON response.

| Parameter        | Meaning                                                                           |
| ---------------- | --------------------------------------------------------------------------------- |
| `affiliation_id` | One Scopus affiliation ID                                                         |
| `eid`            | One affiliation electronic ID; alternative to `affiliation_id`                    |
| `view`           | `BASIC`, `LIGHT` (API default), `STANDARD`, `DOCUMENTS`, `AUTHORS`, or `ENTITLED` |
| `field`          | Comma-separated fields; cannot be used with `DOCUMENTS` or `AUTHORS`              |
| `startref`       | Zero-based offset for related documents or authors                                |
| `refcount`       | Number of related documents or authors                                            |
| `reqId`          | Request identifier for Elsevier support                                           |
| `ver`            | Resource version                                                                  |

Use `DOCUMENTS` or `AUTHORS` for related records, for example:

```json
{
  "affiliation_id": "60016849",
  "view": "AUTHORS",
  "startref": 0,
  "refcount": 25
}
```

The API determines view access and result limits. `BASIC` is supported according
to the response-view chart, although omitted from the WADL enum. Pagination uses
the WADL's native `startref` and `refcount` parameters; each invocation returns
one response. Additional pages and linked profiles are not fetched automatically.

The tool always requests `application/json` and preserves the
`affiliation-retrieval-response` envelope, string counts, nulls, unknown fields,
and partial or view-specific profile data. Credentials come from the server
environment.

## API reference

- [Parameters and endpoints](https://dev.elsevier.com/documentation/AffiliationRetrievalAPI.wadl)
- [Response views](https://dev.elsevier.com/sc_affil_retrieval_views.html)

See the [README](../../README.md#responses-and-errors) for the shared response
and error contract.
