import Type from 'typebox';
import { nonBlankString, optionalText } from '../../schemas/fields';
import { defineSchema } from '../../schemas/schema';

export const inputSchema = defineSchema(
  Type.Object(
    {
      query: Type.Optional(
        nonBlankString(
          'Native author query, e.g. AUTHLASTNAME(Smith) AND AUTHFIRST(John). Required unless co-author is supplied; Elsevier ignores query when both are present.',
        ),
      ),
      'co-author': Type.Optional(
        Type.String({
          pattern: '^\\d+$',
          description:
            'One numeric Scopus author ID as a string. Returns associated co-authors and takes precedence over query.',
        }),
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
          'Comma-separated response fields, e.g. identifier,preferred-name. Overrides view; omitted fields remain absent in the response.',
        ),
      ),
      sort: Type.Optional(
        nonBlankString(
          'Up to three comma-separated sort fields; + ascending, - descending, e.g. -document-count,+surname.',
        ),
      ),
      facets: Type.Optional(
        nonBlankString(
          'Native facet expression, e.g. affilcountry(count=10,sort=fd);active.',
        ),
      ),
      alias: Type.Optional(
        Type.Boolean({
          description:
            'Whether author-ID searches include superseding profiles. Omitted values use the API default of true.',
        }),
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
          'Resource version flags: facetexpand, subjexpand, allexpand, new; comma or semicolon separated.',
        ),
      ),
    },
    {
      additionalProperties: false,
      description:
        'Parameters for one Scopus author search page. Supply query or co-author, or both; co-author takes precedence. Offset pagination is limited to start + count <= 5000.',
      anyOf: [{ required: ['query'] }, { required: ['co-author'] }],
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

const nameSchema = Type.Object(
  {
    surname: optionalText('Author surname.'),
    'given-name': optionalText('Author given name.'),
    initials: optionalText('Author initials.'),
  },
  { additionalProperties: true },
);

const affiliationSchema = Type.Object(
  {
    'affiliation-url': optionalText(
      'Elsevier API URL for the affiliation profile.',
    ),
    'affiliation-id': optionalText('Scopus affiliation ID.'),
    'affiliation-name': optionalText('Affiliation name.'),
    'affiliation-city': optionalText('City of the affiliation.'),
    'affiliation-country': optionalText('Country of the affiliation.'),
  },
  { additionalProperties: true },
);

const subjectSchema = Type.Object(
  {
    '@abbr': optionalText('Subject area abbreviation.'),
    '@frequency': optionalText(
      'Subject frequency reported by Elsevier, retained as a string.',
    ),
    $: optionalText('Subject area label.'),
  },
  { additionalProperties: true },
);

const entrySchema = Type.Object(
  {
    'dc:identifier': optionalText(
      'Scopus author identifier, including its AUTHOR_ID prefix when supplied.',
    ),
    'prism:url': optionalText('Elsevier API URL for the author profile.'),
    eid: optionalText(
      'Scopus electronic identifier (EID) of the author profile.',
    ),
    orcid: optionalText('ORCID identifier reported for the author.'),
    'document-count': optionalText(
      'Document count for the author, retained as the string returned by Elsevier.',
    ),
    'preferred-name': Type.Optional(
      Type.Union([nameSchema, Type.Null()], {
        description:
          'Preferred author name, or null when supplied that way by Elsevier.',
      }),
    ),
    'name-variant': Type.Optional(
      Type.Union([Type.Array(nameSchema), Type.Null()], {
        description: 'Alternative author names reported by Elsevier.',
      }),
    ),
    'affiliation-current': Type.Optional(
      Type.Union(
        [affiliationSchema, Type.Array(affiliationSchema), Type.Null()],
        {
          description:
            'Current affiliation data in native form: one affiliation, an array of affiliations, or null.',
        },
      ),
    ),
    subject: Type.Optional(
      Type.Union([Type.Array(subjectSchema), Type.Null()], {
        description:
          'Subject area labels and frequencies reported for the author.',
      }),
    ),
    // Expanded Elsevier views expose different subject-area representations.
    'subject-area': Type.Optional(
      Type.Ref('#/$defs/jsonValue', {
        description:
          'Expanded subject-area data in its native JSON representation; its shape depends on the requested view and version flags.',
      }),
    ),
    link: Type.Optional(
      Type.Union([Type.Array(linkSchema), Type.Null()], {
        description: 'Links associated with this author profile.',
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
            'Total matching author profiles reported by Elsevier, retained as a string.',
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
                'Author profiles for this page, or native entry-level messages. Fields depend on field selection and entitlements.',
            }),
          ),
        },
        {
          additionalProperties: true,
          description:
            'Native author search response, including page metadata and entries.',
        },
      ),
    },
    {
      additionalProperties: true,
      description:
        'Unmodified JSON envelope returned by the Author Search API.',
      $defs: {
        jsonValue: {
          anyOf: [
            { type: 'string' },
            { type: 'number' },
            { type: 'boolean' },
            { type: 'null' },
            { type: 'array', items: { $ref: '#/$defs/jsonValue' } },
            {
              type: 'object',
              additionalProperties: { $ref: '#/$defs/jsonValue' },
            },
          ],
        },
      },
    },
  ),
);
