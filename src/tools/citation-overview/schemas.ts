import Type, { type TSchema } from 'typebox';
import { nonBlankString, optionalText } from '../../schemas/fields';
import { defineSchema } from '../../schemas/schema';

function identifierList(description: string) {
  return Type.String({
    // Each comma-delimited value must contain a non-whitespace character.
    pattern: '^\\s*[^,\\s][^,]*(?:,\\s*[^,\\s][^,]*)*$',
    description,
  });
}

export const inputSchema = defineSchema(
  Type.Object(
    {
      scopus_id: Type.Optional(
        identifierList(
          'One or more comma-separated Scopus document IDs. Supply exactly one document identifier type.',
        ),
      ),
      doi: Type.Optional(
        identifierList(
          'One or more comma-separated DOIs. Supply exactly one document identifier type.',
        ),
      ),
      pii: Type.Optional(
        identifierList(
          'One or more comma-separated publication item identifiers. Supply exactly one document identifier type.',
        ),
      ),
      pubmed_id: Type.Optional(
        identifierList(
          'One or more comma-separated PubMed IDs. Supply exactly one document identifier type.',
        ),
      ),
      author_id: Type.Optional(
        identifierList(
          'Comma-separated author IDs whose citations should be excluded. Ignored when citation is exclude-books.',
        ),
      ),
      date: Type.Optional(
        nonBlankString(
          'Year or inclusive year range for citation counts, e.g. 2024 or 2020-2024.',
        ),
      ),
      citation: Type.Optional(
        Type.Union(
          [Type.Literal('exclude-self'), Type.Literal('exclude-books')],
          {
            description:
              'Exclude self-citations or book citations; Elsevier includes all citations when omitted.',
          },
        ),
      ),
      view: Type.Optional(
        Type.Literal('STANDARD', {
          description: 'Citation Overview supports only the STANDARD view.',
        }),
      ),
      start: Type.Optional(
        Type.Integer({
          minimum: 0,
          maximum: Number.MAX_SAFE_INTEGER,
          description:
            'Zero-based result offset; Elsevier defaults to zero when omitted.',
        }),
      ),
      count: Type.Optional(
        Type.Integer({
          minimum: 0,
          maximum: Number.MAX_SAFE_INTEGER,
          description:
            'Maximum number of results. Elsevier determines the default and maximum from your API service level.',
        }),
      ),
      field: Type.Optional(
        nonBlankString(
          'Comma-separated native response fields to include. Omit to use the full STANDARD view.',
        ),
      ),
      sort: Type.Optional(
        Type.Union(
          [
            Type.Literal('sort-year'),
            Type.Literal('+sort-year'),
            Type.Literal('-sort-year'),
            Type.Literal('rowTotal'),
            Type.Literal('+rowTotal'),
            Type.Literal('-rowTotal'),
          ],
          {
            description:
              'One sort field: sort-year or rowTotal. Prefix with + for ascending or - for descending; no prefix means ascending.',
          },
        ),
      ),
      reqId: Type.Optional(
        nonBlankString(
          'Caller-supplied request identifier for tracing this request with Elsevier support.',
        ),
      ),
      ver: Type.Optional(
        nonBlankString('Requested Elsevier resource version.'),
      ),
    },
    {
      additionalProperties: false,
      oneOf: [
        { required: ['scopus_id'] },
        { required: ['doi'] },
        { required: ['pii'] },
        { required: ['pubmed_id'] },
      ],
    },
  ),
);

// Native XML-derived JSON may use singleton objects or arrays. Never normalize it.
function optionalCollection<T extends TSchema>(schema: T, description: string) {
  return Type.Optional(
    Type.Union([schema, Type.Array(schema), Type.Null()], { description }),
  );
}

function columnValue(description: string) {
  return Type.Object(
    {
      '@_fa': optionalText(
        'Elsevier XML-to-JSON array marker, preserved as returned.',
      ),
      '@year': optionalText(
        'Year associated with this column, when supplied by Elsevier.',
      ),
      $: optionalText(description),
    },
    { additionalProperties: true },
  );
}

const author = Type.Object(
  {
    initials: optionalText('Author initials as indexed by Scopus.'),
    'index-name': optionalText('Indexed author display name.'),
    surname: optionalText('Author surname.'),
    authid: optionalText('Scopus author identifier.'),
    'author-url': optionalText('Elsevier API URL for the author record.'),
  },
  { additionalProperties: true },
);

const identifier = Type.Object(
  {
    'dc:identifier': optionalText(
      'Native document identifier, usually prefixed with SCOPUS_ID:.',
    ),
    'prism:doi': optionalText('Document DOI.'),
    pii: optionalText('Publication item identifier.'),
    scopus_id: optionalText('Scopus document identifier.'),
    pubmed_id: optionalText('PubMed document identifier.'),
  },
  { additionalProperties: true },
);

const citationType = Type.Object(
  {
    '@code': optionalText('Native document type code, e.g. ar for an article.'),
    $: optionalText('Document type label, e.g. Article.'),
  },
  { additionalProperties: true },
);

const citeInfo = Type.Object(
  {
    'dc:identifier': optionalText(
      'Native identifier for the document represented by this row.',
    ),
    'prism:url': optionalText('Elsevier API URL for the document abstract.'),
    'dc:title': optionalText('Document title.'),
    author: optionalCollection(
      author,
      'Document authors, as one native object or an array.',
    ),
    citationType: Type.Optional(
      Type.Union([citationType, Type.Null()], {
        description: 'Native document type code and label.',
      }),
    ),
    'sort-year': optionalText(
      'Publication year used to sort the document row.',
    ),
    'prism:publicationName': optionalText(
      'Journal or other source publication name.',
    ),
    'prism:volume': optionalText('Source volume designation.'),
    'prism:issueIdentifier': optionalText('Source issue designation.'),
    'prism:startingPage': optionalText('First page of the document.'),
    'prism:endingPage': optionalText('Last page of the document.'),
    'prism:issn': optionalText('Source publication ISSN.'),
    pcc: optionalText(
      'Citation count before the requested year range, as a string.',
    ),
    cc: optionalCollection(
      columnValue('Citation count for this year column, as a string.'),
      'Yearly citation counts in the order of columnHeading; one object or an array.',
    ),
    lcc: optionalText(
      'Citation count after the requested year range, as a string.',
    ),
    rangeCount: optionalText(
      'Citation count within the requested year range, as a string.',
    ),
    rowTotal: optionalText(
      'Total citation count for this document row across all year columns, as a string.',
    ),
  },
  { additionalProperties: true },
);

const citationMatrix = Type.Object(
  {
    citeInfo: optionalCollection(
      citeInfo,
      'Citation rows for the requested documents; one object or an array.',
    ),
  },
  { additionalProperties: true },
);

const citeInfoMatrixXML = Type.Object(
  {
    citationMatrix: Type.Optional(
      Type.Union([citationMatrix, Type.Null()], {
        description: 'Native container for the per-document citation rows.',
      }),
    ),
  },
  { additionalProperties: true },
);

const citeInfoMatrix = Type.Object(
  {
    citeInfoMatrixXML: Type.Optional(
      Type.Union([citeInfoMatrixXML, Type.Null()], {
        description: 'XML-derived JSON container for the citation matrix.',
      }),
    ),
  },
  { additionalProperties: true },
);

const identifierLegend = Type.Object(
  {
    identifier: optionalCollection(
      identifier,
      'Identifiers associated with the requested documents; one object or an array.',
    ),
  },
  { additionalProperties: true },
);

const citeCountHeader = Type.Object(
  {
    prevColumnHeading: optionalText(
      'Label for the column covering years before the requested range.',
    ),
    columnHeading: optionalCollection(
      columnValue('Year label for this citation column.'),
      'Year column headings, in the same order as cc and columnTotal.',
    ),
    laterColumnHeading: optionalText(
      'Label for the column covering years after the requested range.',
    ),
    prevColumnTotal: optionalText(
      'Citation total before the requested year range, as a string.',
    ),
    columnTotal: optionalCollection(
      columnValue('Citation total for this year column, as a string.'),
      'Citation totals across document rows for each year, in columnHeading order.',
    ),
    laterColumnTotal: optionalText(
      'Citation total after the requested year range, as a string.',
    ),
    rangeColumnTotal: optionalText(
      'Citation total within the requested year range, as a string.',
    ),
    grandTotal: optionalText(
      'Citation total across all document rows and year columns, as a string.',
    ),
  },
  { additionalProperties: true },
);

const citeColumnTotalXML = Type.Object(
  {
    citeCountHeader: Type.Optional(
      Type.Union([citeCountHeader, Type.Null()], {
        description: 'Citation column labels and aggregate counts.',
      }),
    ),
  },
  { additionalProperties: true },
);

export const outputSchema = defineSchema(
  Type.Object(
    {
      'abstract-citations-response': Type.Object(
        {
          'h-index': optionalText(
            'H-index reported by Elsevier for this citation overview, as a string.',
          ),
          'identifier-legend': Type.Optional(
            Type.Union([identifierLegend, Type.Null()], {
              description:
                'Mapping of native identifiers for the requested documents.',
            }),
          ),
          citeInfoMatrix: Type.Optional(
            Type.Union([citeInfoMatrix, Type.Null()], {
              description:
                'Native citation matrix with per-document metadata and yearly counts.',
            }),
          ),
          citeColumnTotalXML: Type.Optional(
            Type.Union([citeColumnTotalXML, Type.Null()], {
              description:
                'XML-derived JSON container for year headings and aggregate citation totals.',
            }),
          ),
        },
        {
          additionalProperties: true,
          description:
            'Native Elsevier Citation Overview response. Counts and years remain strings; requested fields may be omitted or null.',
        },
      ),
    },
    { additionalProperties: true },
  ),
);
