# PlumX Metrics

`plumx_metrics` makes one GET request to
`/analytics/plumx/{idType}/{idValue}` and returns native metrics for a single
publication or other artifact. It does not combine categories, calculate totals,
or follow links.

```json
{
  "idType": "doi",
  "idValue": "10.1103/physrevlett.116.061102"
}
```

| Parameter | Type             | Description                                                     |
| --------- | ---------------- | --------------------------------------------------------------- |
| `idType`  | string, required | `doi`, `elsevierId`, `elsevierPii`, `isbn`, `pmcid`, or `pmid`. |
| `idValue` | string, required | Original identifier value; the server handles URL encoding.     |
| `reqId`   | string           | Optional caller-supplied request identifier.                    |

The native API uses camel case for input path parameters and snake case for
response fields. Responses retain `id_type`, `id_value`, `count_categories`,
`count_types`, and optional `sources`, including numeric totals, null values,
partial metrics, and unknown fields. Category and source names remain as returned
by Elsevier. There are no pagination or view parameters.

An active Scopus subscription is required. A **404** may mean either an unknown
identifier or that no metrics exist for it. The tool returns that upstream error;
it does not substitute empty metrics or zero counts. Other errors and quota
headers follow the [common response contract](../../README.md#responses-and-errors).

References:

- [PlumX Metrics API parameters and errors](https://dev.elsevier.com/documentation/PlumXMetricsAPI.wadl)
- [Official Scopus API guide](https://dev.elsevier.com/guides/Scopus%20API%20Guide_V1_20230907.pdf) (JSON example on pages 24–26 and API description on page 42)
