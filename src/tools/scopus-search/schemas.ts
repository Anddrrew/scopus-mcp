import Type from 'typebox';
import { nonBlankString, optionalText } from '../../schemas/fields';
import { defineSchema } from '../../schemas/schema';

export const inputSchema = defineSchema(
  Type.Object(
    {
      query: nonBlankString(
        'Native Scopus publication query, e.g. TITLE-ABS-KEY(machine learning) AND PUBYEAR > 2020.',
      ),
      view: Type.Optional(
        Type.Union(
          [
            Type.Literal('STANDARD'),
            Type.Literal('COMPLETE'),
            Type.Literal('COMPONENT'),
          ],
          {
            default: 'STANDARD',
            description:
              'Response view. Defaults to STANDARD; COMPLETE and COMPONENT require the relevant Scopus entitlements. Overridden by field.',
          },
        ),
      ),
      count: Type.Optional(
        Type.Integer({
          minimum: 0,
          maximum: 200,
          default: 25,
          description:
            'Maximum results in this page. Defaults to 25; up to 200 for STANDARD or 25 for COMPLETE/COMPONENT. With field, Elsevier determines the effective view and limit.',
        }),
      ),
      start: Type.Optional(
        Type.Integer({
          minimum: 0,
          maximum: 5000,
          description:
            'Zero-based result offset. Use instead of cursor. The requested window start + count must not exceed 5000; omitted count means 25.',
        }),
      ),
      cursor: Type.Optional(
        nonBlankString(
          'Use * for the first cursor page, then search-results.cursor["@next"] from the previous response. Use instead of start; keep the query and other options unchanged.',
        ),
      ),
      date: Type.Optional(
        nonBlankString(
          'Publication year or inclusive year range, e.g. 2024 or 2020-2024.',
        ),
      ),
      sort: Type.Optional(
        nonBlankString(
          'Up to three comma-separated sort fields; + ascending, - descending, e.g. -coverDate,+creator.',
        ),
      ),
      field: Type.Optional(
        nonBlankString(
          'Comma-separated response fields, e.g. identifier,title,doi. Overrides view; omitted fields remain absent in the response.',
        ),
      ),
      subj: Type.Optional(
        nonBlankString('Scopus subject area code to filter by, e.g. COMP.'),
      ),
      facets: Type.Optional(
        nonBlankString(
          'Native facet expression, e.g. pubyear;subjarea(count=10,sort=fd).',
        ),
      ),
      content: Type.Optional(
        Type.Union(
          [Type.Literal('all'), Type.Literal('core'), Type.Literal('dummy')],
          {
            description:
              'Scopus content collection to search: all, core, or dummy.',
          },
        ),
      ),
      alias: Type.Optional(
        Type.Boolean({
          description:
            'Whether author-ID searches include superseded profiles. Omitted values use the API default of true.',
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
          'Resource version flags: facetexpand, allexpand, new; comma or semicolon separated.',
        ),
      ),
    },
    {
      additionalProperties: false,
      description:
        'Parameters for one Scopus publication search page. Offset pagination is limited to start + count <= 5000; use cursor to request later pages.',
      not: { required: ['start', 'cursor'] },
      if: {
        required: ['view'],
        properties: { view: { enum: ['COMPLETE', 'COMPONENT'] } },
        not: { required: ['field'] },
      },
      then: { properties: { count: { maximum: 25 } } },
    },
  ),
  (input) =>
    input.cursor === undefined &&
    (input.start ?? 0) + (input.count ?? 25) > 5000
      ? 'Offset pagination is limited to 5000 results. Use cursor pagination.'
      : undefined,
);

// Entry fields depend on field selection and entitlements. Preserve native JSON,
// including nullable text, string counts, and unrecognized Elsevier properties.
const linkSchema = Type.Object(
  {
    '@ref': optionalText(
      'Relation of the linked resource, as returned by Elsevier.',
    ),
    '@href': optionalText('URL of the linked resource.'),
  },
  { additionalProperties: true },
);

const affiliationSchema = Type.Object(
  {
    afid: optionalText('Scopus affiliation ID.'),
    affilname: optionalText('Affiliation name.'),
    'affiliation-url': optionalText(
      'Elsevier API URL for the affiliation profile.',
    ),
    'affiliation-city': optionalText('City of the affiliation.'),
    'affiliation-country': optionalText('Country of the affiliation.'),
  },
  { additionalProperties: true },
);

const authorSchema = Type.Object(
  {
    authid: optionalText('Scopus author ID.'),
    authname: optionalText('Author display name.'),
    'author-url': optionalText('Elsevier API URL for the author profile.'),
    'given-name': optionalText('Author given name.'),
    surname: optionalText('Author surname.'),
    initials: optionalText('Author initials.'),
    orcid: optionalText('ORCID identifier reported for the author.'),
  },
  { additionalProperties: true },
);

const entrySchema = Type.Object(
  {
    'dc:identifier': optionalText(
      'Scopus document identifier, including its SCOPUS_ID prefix when supplied.',
    ),
    eid: optionalText('Scopus electronic identifier (EID) of the document.'),
    'dc:title': optionalText('Publication title.'),
    'dc:creator': optionalText('Creator name reported for the publication.'),
    'dc:description': optionalText(
      'Publication description or abstract, when included in the selected view.',
    ),
    'prism:url': optionalText('Elsevier API URL for the document.'),
    'prism:doi': optionalText(
      'Digital object identifier (DOI) of the publication.',
    ),
    'prism:publicationName': optionalText(
      'Name of the journal or other publication source.',
    ),
    'prism:issn': optionalText('Print ISSN reported for the source.'),
    'prism:eIssn': optionalText('Electronic ISSN reported for the source.'),
    'prism:volume': optionalText('Source volume designation.'),
    'prism:issueIdentifier': optionalText('Source issue designation.'),
    'prism:pageRange': optionalText(
      'Publication page range as supplied by Elsevier.',
    ),
    'prism:coverDate': Type.Optional(
      Type.Union(
        [
          Type.String(),
          Type.Array(
            Type.Object(
              { $: Type.String({ description: 'Cover date text.' }) },
              { additionalProperties: true },
            ),
          ),
          Type.Null(),
        ],
        {
          description:
            'Cover date in native Elsevier form: a string, an array of date objects, or null.',
        },
      ),
    ),
    'prism:coverDisplayDate': optionalText('Human-readable cover date.'),
    'prism:aggregationType': optionalText(
      'Publication source type, such as Journal.',
    ),
    'citedby-count': optionalText(
      'Citation count, retained as the string returned by Elsevier.',
    ),
    subtype: optionalText('Scopus document subtype code.'),
    subtypeDescription: optionalText('Human-readable document subtype.'),
    authkeywords: optionalText(
      'Author keywords in the original Elsevier text representation.',
    ),
    openaccess: optionalText(
      'Native open-access indicator, retained as a string.',
    ),
    openaccessFlag: Type.Optional(
      Type.Union([Type.Boolean(), Type.Null()], {
        description:
          'Boolean open-access flag, or null when supplied that way by Elsevier.',
      }),
    ),
    link: Type.Optional(
      Type.Array(linkSchema, {
        description: 'Links associated with this publication.',
      }),
    ),
    affiliation: Type.Optional(
      Type.Array(affiliationSchema, {
        description: 'Affiliations associated with this publication.',
      }),
    ),
    author: Type.Optional(
      Type.Array(authorSchema, {
        description: 'Authors included in the selected response view.',
      }),
    ),
    error: optionalText(
      'Entry-level message returned by Elsevier, including no-result entries.',
    ),
  },
  { additionalProperties: true },
);

export const outputSchema = defineSchema(
  Type.Object(
    {
      'search-results': Type.Object(
        {
          'opensearch:totalResults': optionalText(
            'Total matching publications reported by Elsevier, retained as a string.',
          ),
          'opensearch:startIndex': optionalText(
            'Zero-based offset of this page, retained as a string.',
          ),
          'opensearch:itemsPerPage': optionalText(
            'Page size reported by Elsevier, retained as a string.',
          ),
          'opensearch:Query': Type.Optional(
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
              {
                additionalProperties: true,
                description: 'OpenSearch metadata for the executed query.',
              },
            ),
          ),
          cursor: Type.Optional(
            Type.Object(
              {
                '@current': optionalText(
                  'Cursor identifying the current result page.',
                ),
                '@next': optionalText(
                  'Cursor to supply unchanged in the next search request.',
                ),
              },
              {
                additionalProperties: true,
                description: 'Cursor pagination tokens supplied by Elsevier.',
              },
            ),
          ),
          link: Type.Optional(
            Type.Array(linkSchema, {
              description:
                'Response and pagination links supplied by Elsevier.',
            }),
          ),
          entry: Type.Optional(
            Type.Array(entrySchema, {
              description:
                'Publication results for this page, or native entry-level messages. Fields depend on view, field selection, and entitlements.',
            }),
          ),
        },
        {
          additionalProperties: true,
          description:
            'Native Scopus search response, including page metadata and entries.',
        },
      ),
    },
    {
      additionalProperties: true,
      description:
        'Unmodified JSON envelope returned by the Scopus Search API.',
    },
  ),
);
