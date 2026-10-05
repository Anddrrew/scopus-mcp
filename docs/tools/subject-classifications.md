# Subject Classifications

`subject_classifications` calls
`GET https://api.elsevier.com/content/subject/scopus` and returns native JSON.
This public endpoint does not require an API key. It covers Scopus subject
classifications; the separate ScienceDirect classification endpoint is outside
this tool's scope.

## Example

```json
{
  "abbrev": "AGRI",
  "field": "code,detail"
}
```

Pass `{}` to retrieve all classifications in one request.

| Parameter     | Meaning                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------- |
| `description` | Case-insensitive partial match on the primary description.                                   |
| `detail`      | Case-insensitive partial match on the detail, e.g. `food`.                                   |
| `code`        | Exact code as a string, e.g. `1106`.                                                         |
| `abbrev`      | Case-insensitive exact abbreviation, e.g. `AGRI`.                                            |
| `field`       | Comma-separated `code`, `abbrev`, `detail`, and/or `description`. Omit to return all fields. |

All parameters are optional. The endpoint has no pagination or `view` parameter.
`parentCode` belongs to the ScienceDirect endpoint and is not accepted here.

## Response

The native `subject-classifications` wrapper is retained. Its
`subject-classification` value may be a single object or an array. No matches
can return HTTP 200 with `{"error":"No results found"}` inside the wrapper;
this remains a successful native response. Field selection, nulls, and unknown
fields are preserved without adding defaults or normalizing cardinality.

See the [README](../../README.md#responses-and-errors) for the shared MCP
response and error contract.

## API reference

- [Subject Classifications parameters](https://dev.elsevier.com/documentation/SubjectClassificationsAPI.wadl)
