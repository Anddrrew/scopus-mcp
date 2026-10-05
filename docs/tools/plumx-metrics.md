# PlumX Metrics

`plumx_metrics` retrieves metrics for a publication or other artifact via
`GET /analytics/plumx/{idType}/{idValue}`.

```json
{
  "idType": "doi",
  "idValue": "10.1103/physrevlett.116.061102"
}
```

## Parameters

| Parameter | Description                                                                 |
| --------- | --------------------------------------------------------------------------- |
| `idType`  | Required: `doi`, `elsevierId`, `elsevierPii`, `isbn`, `pmcid`, or `pmid`.   |
| `idValue` | Required identifier string. Supply the original value without URL encoding. |
| `reqId`   | Optional caller-supplied request identifier.                                |

## Notes

An active Scopus subscription is required. HTTP **404** can mean either an unknown
identifier or that no metrics are available; it remains an error response.

## API reference

- [Parameters and errors](https://dev.elsevier.com/documentation/PlumXMetricsAPI.wadl)
- [Scopus API guide](https://dev.elsevier.com/guides/Scopus%20API%20Guide_V1_20230907.pdf)
- [Responses and errors](../../README.md#responses-and-errors)
