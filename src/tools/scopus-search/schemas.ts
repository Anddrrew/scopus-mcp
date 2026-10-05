import { z } from 'zod';

const nonBlank = z.string().refine((value) => value.trim().length > 0, 'Must not be blank.');

export const inputSchema = z.strictObject({
  query: nonBlank.describe('Scopus query, e.g. TITLE-ABS-KEY(machine learning) AND PUBYEAR > 2020.'),
  view: z.enum(['STANDARD', 'COMPLETE', 'COMPONENT']).default('STANDARD')
    .describe('COMPLETE and COMPONENT require the relevant Scopus entitlements.'),
  count: z.int().min(0).max(200).default(25)
    .describe('Page size: up to 200 for STANDARD, 25 for COMPLETE/COMPONENT.'),
  start: z.int().min(0).optional().describe('Zero-based result offset. Use instead of cursor.'),
  cursor: nonBlank.optional().describe('Use * for the first cursor page, then the returned cursor/@next. Use instead of start.'),
  date: nonBlank.optional().describe('Year or year range, e.g. 2024 or 2020-2024.'),
  sort: nonBlank.optional().describe('Up to three comma-separated sort fields; + ascending, - descending, e.g. -coverDate,+creator.'),
  field: nonBlank.optional().describe('Comma-separated response fields. Overrides view, e.g. identifier,title,doi.'),
  subj: nonBlank.optional().describe('Scopus subject area code, e.g. COMP.'),
  facets: nonBlank.optional().describe('Scopus facet expression, e.g. pubyear;subjarea(count=10,sort=fd).'),
  content: z.enum(['all', 'core', 'dummy']).optional(),
  alias: z.boolean().optional().describe('Whether author ID searches include superseded profiles (API default: true).'),
  suppressNavLinks: z.boolean().optional().describe('Suppress top-level navigation links (API default: false).'),
  reqId: nonBlank.optional().describe('Caller-supplied request identifier for Elsevier support.'),
  ver: nonBlank.optional().describe('Resource version flags: facetexpand, allexpand, new; comma or semicolon separated.'),
}).superRefine((input, ctx) => {
  if (input.cursor !== undefined && input.start !== undefined) {
    ctx.addIssue({ code: 'custom', path: ['start'], message: 'Use either start or cursor, not both.' });
  }
  if (!input.field && input.view !== 'STANDARD' && input.count > 25) {
    ctx.addIssue({ code: 'custom', path: ['count'], message: 'COMPLETE and COMPONENT views allow at most 25 results per page.' });
  }
  if (input.cursor === undefined && (input.start ?? 0) + input.count > 5000) {
    ctx.addIssue({ code: 'custom', path: ['start'], message: 'Offset pagination is limited to 5000 results. Use cursor pagination.' });
  }
});

// Keep the Elsevier wire format, including string counts and unknown fields.
// Every entry field is optional because `field` and entitlements change the payload.
const optionalText = z.string().nullable().optional();
const linkSchema = z.looseObject({ '@ref': optionalText, '@href': optionalText });
const affiliationSchema = z.looseObject({
  afid: optionalText,
  affilname: optionalText,
  'affiliation-url': optionalText,
  'affiliation-city': optionalText,
  'affiliation-country': optionalText,
});
const authorSchema = z.looseObject({
  authid: optionalText,
  authname: optionalText,
  'author-url': optionalText,
  'given-name': optionalText,
  surname: optionalText,
  initials: optionalText,
  orcid: optionalText,
});
const entrySchema = z.looseObject({
  'dc:identifier': optionalText,
  eid: optionalText,
  'dc:title': optionalText,
  'dc:creator': optionalText,
  'dc:description': optionalText,
  'prism:url': optionalText,
  'prism:doi': optionalText,
  'prism:publicationName': optionalText,
  'prism:issn': optionalText,
  'prism:eIssn': optionalText,
  'prism:volume': optionalText,
  'prism:issueIdentifier': optionalText,
  'prism:pageRange': optionalText,
  'prism:coverDate': optionalText,
  'prism:coverDisplayDate': optionalText,
  'prism:aggregationType': optionalText,
  'citedby-count': optionalText,
  subtype: optionalText,
  subtypeDescription: optionalText,
  authkeywords: optionalText,
  openaccess: optionalText,
  openaccessFlag: z.boolean().nullable().optional(),
  link: z.array(linkSchema).optional(),
  affiliation: z.array(affiliationSchema).optional(),
  author: z.array(authorSchema).optional(),
  error: optionalText,
});

export const outputSchema = z.looseObject({
  'search-results': z.looseObject({
    'opensearch:totalResults': optionalText,
    'opensearch:startIndex': optionalText,
    'opensearch:itemsPerPage': optionalText,
    'opensearch:Query': z.looseObject({
      '@role': optionalText,
      '@searchTerms': optionalText,
      '@startPage': optionalText,
    }).optional(),
    cursor: z.looseObject({ '@current': optionalText, '@next': optionalText }).optional(),
    link: z.array(linkSchema).optional(),
    entry: z.array(entrySchema).optional(),
  }),
});
