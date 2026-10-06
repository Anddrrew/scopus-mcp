import Type from 'typebox';
import { nonBlankString, optionalText } from '../../schemas/fields';
import { defineSchema } from '../../schemas/schema';

export const inputSchema = defineSchema(
  Type.Object(
    {
      query: nonBlankString(
        'Native affiliation query, e.g. AFFIL(university) AND AFFIL(London).',
      ),
      view: Type.Optional(
        Type.Literal('STANDARD', {
          default: 'STANDARD',
          description:
            'Response view. STANDARD is the default and only supported view; overridden by field.',
        }),
      ),
      count: Type.Optional(
        Type.Integer({
          minimum: 0,
          maximum: 200,
          default: 25,
          description:
            'Maximum results in this page, from 0 to 200. Defaults to 25.',
        }),
      ),
      start: Type.Optional(
        Type.Integer({
          minimum: 0,
          maximum: 5000,
          description:
            'Zero-based result offset. The requested window start + count must not exceed 5000; omitted count means 25.',
        }),
      ),
      field: Type.Optional(
        nonBlankString(
          'Comma-separated response fields, e.g. identifier,affiliation-name. Overrides view; omitted fields remain absent in the response.',
        ),
      ),
      sort: Type.Optional(
        nonBlankString(
          'Up to three comma-separated sort fields; + ascending, - descending, e.g. -document-count,+affiliation-name.',
        ),
      ),
      facets: Type.Optional(
        nonBlankString(
          'Native facet expression, e.g. affilcountry(count=10,sort=fd);affilcity.',
        ),
      ),
      suppressNavLinks: Type.Optional(
        Type.Boolean({
          description:
            'Suppress top-level navigation links. Omitted values use the API default of false.',
        }),
      ),
      reqId: Type.Optional(
        nonBlankString(
          'Caller-supplied request identifier for Elsevier support.',
        ),
      ),
      ver: Type.Optional(
        nonBlankString(
          'Resource version flags: facetexpand, allexpand, new; comma or semicolon separated.',
        ),
      ),
    },
    {
      additionalProperties: false,
      description:
        'Parameters for one Scopus affiliation search page. Offset pagination is limited to start + count <= 5000.',
    },
  ),
  (input) =>
    (input.start ?? 0) + (input.count ?? 25) > 5000
      ? 'Offset pagination is limited to 5000 results.'
      : undefined,
);

const linkSchema = Type.Object(
  {
    '@ref': optionalText(
      'Relation of the linked resource, as returned by Elsevier.',
    ),
    '@href': optionalText('URL of the linked resource.'),
  },
  { additionalProperties: true },
);

const entrySchema = Type.Object(
  {
    'dc:identifier': optionalText(
      'Scopus affiliation identifier, including its AFFILIATION_ID prefix when supplied.',
    ),
    'prism:url': optionalText('Elsevier API URL for the affiliation profile.'),
    eid: optionalText(
      'Scopus electronic identifier (EID) of the affiliation profile.',
    ),
    'parent-affiliation-id': optionalText(
      'Scopus ID of the parent affiliation, when supplied.',
    ),
    'affiliation-name': optionalText('Affiliation name.'),
    'name-variant': Type.Optional(
      Type.Union(
        [
          Type.Array(
            Type.Object(
              { $: optionalText('Alternative affiliation name.') },
              { additionalProperties: true },
            ),
          ),
          Type.Null(),
        ],
        { description: 'Alternative affiliation names reported by Elsevier.' },
      ),
    ),
    city: optionalText('City of the affiliation.'),
    country: optionalText('Country of the affiliation.'),
    'document-count': optionalText(
      'Document count for the affiliation, retained as the string returned by Elsevier.',
    ),
    link: Type.Optional(
      Type.Union([Type.Array(linkSchema), Type.Null()], {
        description: 'Links associated with this affiliation profile.',
      }),
    ),
    error: optionalText(
      'Entry-level message returned by Elsevier, including no-result entries.',
    ),
  },
  { additionalProperties: true },
);

// Field selection and entitlements can omit any entry field. Keep the wire format.
export const outputSchema = defineSchema(
  Type.Object(
    {
      'search-results': Type.Object(
        {
          'opensearch:totalResults': optionalText(
            'Total matching affiliations reported by Elsevier, retained as a string.',
          ),
          'opensearch:startIndex': optionalText(
            'Zero-based offset of this page, retained as a string.',
          ),
          'opensearch:itemsPerPage': optionalText(
            'Page size reported by Elsevier, retained as a string.',
          ),
          'opensearch:Query': Type.Optional(
            Type.Union(
              [
                Type.Object(
                  {
                    '@role': optionalText(
                      'Role of the query in the OpenSearch response.',
                    ),
                    '@searchTerms': optionalText(
                      'Search terms echoed by Elsevier.',
                    ),
                    '@startPage': optionalText(
                      'Starting page reported by Elsevier, retained as a string.',
                    ),
                  },
                  { additionalProperties: true },
                ),
                Type.Null(),
              ],
              { description: 'OpenSearch metadata for the executed query.' },
            ),
          ),
          link: Type.Optional(
            Type.Union([Type.Array(linkSchema), Type.Null()], {
              description:
                'Response and pagination links supplied by Elsevier.',
            }),
          ),
          entry: Type.Optional(
            Type.Union([Type.Array(entrySchema), Type.Null()], {
              description:
                'Affiliation profiles for this page, or native entry-level messages. Fields depend on field selection and entitlements.',
            }),
          ),
        },
        {
          additionalProperties: true,
          description:
            'Native affiliation search response, including page metadata and entries.',
        },
      ),
    },
    {
      additionalProperties: true,
      description:
        'Unmodified JSON envelope returned by the Affiliation Search API.',
    },
  ),
);
