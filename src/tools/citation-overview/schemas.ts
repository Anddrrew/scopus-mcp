import { z } from 'zod';

const nonBlank = z
  .string()
  .refine((value) => value.trim().length > 0, 'Must not be blank.');
const identifiers = nonBlank.refine(
  (value) => value.split(',').every((id) => id.trim().length > 0),
  'Identifier lists must not contain empty values.',
);

export const inputSchema = z
  .strictObject({
    scopus_id: identifiers
      .optional()
      .describe(
        'One or more comma-separated Scopus document IDs. Use exactly one document identifier type.',
      ),
    doi: identifiers
      .optional()
      .describe(
        'One or more comma-separated DOIs. Use exactly one document identifier type.',
      ),
    pii: identifiers
      .optional()
      .describe(
        'One or more comma-separated publication item identifiers. Use exactly one document identifier type.',
      ),
    pubmed_id: identifiers
      .optional()
      .describe(
        'One or more comma-separated PubMed IDs. Use exactly one document identifier type.',
      ),
    author_id: identifiers
      .optional()
      .describe(
        'Comma-separated author IDs whose citations should be excluded. Ignored when citation is exclude-books.',
      ),
    date: nonBlank
      .optional()
      .describe('Year or year range, e.g. 2024 or 2020-2024.'),
    citation: z
      .enum(['exclude-self', 'exclude-books'])
      .optional()
      .describe(
        'Exclude self-citations or book citations; Elsevier includes all citations by default.',
      ),
    view: z
      .literal('STANDARD')
      .optional()
      .describe('Citation Overview supports the STANDARD view.'),
    start: z
      .int()
      .min(0)
      .optional()
      .describe('Zero-based result offset; Elsevier defaults to zero.'),
    count: z
      .int()
      .min(0)
      .optional()
      .describe(
        'Maximum results; the default and maximum depend on your API service level.',
      ),
    field: nonBlank
      .optional()
      .describe('Comma-separated native response fields.'),
    sort: z
      .enum([
        'sort-year',
        '+sort-year',
        '-sort-year',
        'rowTotal',
        '+rowTotal',
        '-rowTotal',
      ])
      .optional()
      .describe(
        'One sort field, optionally prefixed with + or -; ascending by default.',
      ),
    reqId: nonBlank
      .optional()
      .describe('Caller-supplied request identifier for Elsevier support.'),
    ver: nonBlank.optional().describe('Requested Elsevier resource version.'),
  })
  .superRefine((input, ctx) => {
    if (
      [input.scopus_id, input.doi, input.pii, input.pubmed_id].filter(
        (value) => value !== undefined,
      ).length !== 1
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide exactly one of scopus_id, doi, pii, or pubmed_id.',
      });
    }
  });

// Native XML-derived JSON may use singleton objects or arrays. Never normalize it.
const text = z.string().nullable().optional();
const values = z.looseObject({ '@_fa': text, '@year': text, $: text });
const authors = z.looseObject({
  initials: text,
  'index-name': text,
  surname: text,
  authid: text,
  'author-url': text,
});
const identifiersSchema = z.looseObject({
  'dc:identifier': text,
  'prism:doi': text,
  pii: text,
  scopus_id: text,
  pubmed_id: text,
});
const citeInfo = z.looseObject({
  'dc:identifier': text,
  'prism:url': text,
  'dc:title': text,
  author: z
    .union([authors, z.array(authors)])
    .nullable()
    .optional(),
  citationType: z.looseObject({ '@code': text, $: text }).nullable().optional(),
  'sort-year': text,
  'prism:publicationName': text,
  'prism:volume': text,
  'prism:issueIdentifier': text,
  'prism:startingPage': text,
  'prism:endingPage': text,
  'prism:issn': text,
  pcc: text,
  cc: z
    .union([values, z.array(values)])
    .nullable()
    .optional(),
  lcc: text,
  rangeCount: text,
  rowTotal: text,
});

export const outputSchema = z.looseObject({
  'abstract-citations-response': z.looseObject({
    'h-index': text,
    'identifier-legend': z
      .looseObject({
        identifier: z
          .union([identifiersSchema, z.array(identifiersSchema)])
          .nullable()
          .optional(),
      })
      .nullable()
      .optional(),
    citeInfoMatrix: z
      .looseObject({
        citeInfoMatrixXML: z
          .looseObject({
            citationMatrix: z
              .looseObject({
                citeInfo: z
                  .union([citeInfo, z.array(citeInfo)])
                  .nullable()
                  .optional(),
              })
              .nullable()
              .optional(),
          })
          .nullable()
          .optional(),
      })
      .nullable()
      .optional(),
    citeColumnTotalXML: z
      .looseObject({
        citeCountHeader: z
          .looseObject({
            prevColumnHeading: text,
            columnHeading: z
              .union([values, z.array(values)])
              .nullable()
              .optional(),
            laterColumnHeading: text,
            prevColumnTotal: text,
            columnTotal: z
              .union([values, z.array(values)])
              .nullable()
              .optional(),
            laterColumnTotal: text,
            rangeColumnTotal: text,
            grandTotal: text,
          })
          .nullable()
          .optional(),
      })
      .nullable()
      .optional(),
  }),
});
