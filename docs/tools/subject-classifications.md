# Subject Classifications

`subject_classifications` retrieves or filters Scopus subject codes and
descriptions via `GET /content/subject/scopus`. No API key is required.

```json
{
  "abbrev": "AGRI",
  "field": "code,detail"
}
```

Pass `{}` to retrieve all classifications.

## Parameters

All parameters are optional strings.

| Parameter     | Description                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------- |
| `description` | Case-insensitive partial match on the primary description.                                   |
| `detail`      | Case-insensitive partial match on the detail, e.g. `food`.                                   |
| `code`        | Exact code, e.g. `1106`.                                                                     |
| `abbrev`      | Case-insensitive exact abbreviation, e.g. `AGRI`.                                            |
| `field`       | Comma-separated `code`, `abbrev`, `detail`, and/or `description`. Omit to return all fields. |

## Notes

Within `subject-classifications`, `subject-classification` can be an object or
an array. No matches can return HTTP 200 with `{"error":"No results found"}` inside
the wrapper; this is a successful response.

## API reference

- [Parameters](https://dev.elsevier.com/documentation/SubjectClassificationsAPI.wadl)
- [Responses and errors](../../README.md#responses-and-errors)
