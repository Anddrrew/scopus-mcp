import { z } from 'zod';

const nonBlank = z
  .string()
  .refine((value) => value.trim().length > 0, 'Must not be blank.');

export const inputSchema = z
  .strictObject({
    query: nonBlank.describe(
      'Native affiliation query, e.g. AFFIL(university) AND AFFIL(London).',
    ),
    view: z.literal('STANDARD').default('STANDARD'),
    count: z
      .int()
      .min(0)
      .max(200)
      .default(25)
      .describe('Maximum results per page, up to 200.'),
    start: z
      .int()
      .min(0)
      .optional()
      .describe(
        'Zero-based offset. The requested window must fit within 5000 results.',
      ),
    field: nonBlank
      .optional()
      .describe('Comma-separated response fields; overrides view.'),
    sort: nonBlank
      .optional()
      .describe(
        'Up to three comma-separated sort fields, e.g. -document-count,+affiliation-name.',
      ),
    facets: nonBlank
      .optional()
      .describe(
        'Native facet expression, e.g. affilcountry(count=10,sort=fd);affilcity.',
      ),
    suppressNavLinks: z
      .boolean()
      .optional()
      .describe('Suppress top-level navigation links (API default: false).'),
    reqId: nonBlank
      .optional()
      .describe('Caller-supplied request identifier for Elsevier support.'),
    ver: nonBlank
      .optional()
      .describe(
        'Resource version flags: facetexpand, allexpand, new; comma or semicolon separated.',
      ),
  })
  .superRefine((input, ctx) => {
    if ((input.start ?? 0) + input.count > 5000) {
      ctx.addIssue({
        code: 'custom',
        path: ['start'],
        message: 'Offset pagination is limited to 5000 results.',
      });
    }
  });

const optionalText = z.string().nullable().optional();
const linkSchema = z.looseObject({
  '@ref': optionalText,
  '@href': optionalText,
});
const entrySchema = z.looseObject({
  'dc:identifier': optionalText,
  'prism:url': optionalText,
  eid: optionalText,
  'parent-affiliation-id': optionalText,
  'affiliation-name': optionalText,
  'name-variant': z
    .array(z.looseObject({ $: optionalText }))
    .nullable()
    .optional(),
  city: optionalText,
  country: optionalText,
  'document-count': optionalText,
  link: z.array(linkSchema).nullable().optional(),
  error: optionalText,
});

// Field selection and entitlements can omit any entry field. Keep the wire format.
export const outputSchema = z.looseObject({
  'search-results': z.looseObject({
    'opensearch:totalResults': optionalText,
    'opensearch:startIndex': optionalText,
    'opensearch:itemsPerPage': optionalText,
    'opensearch:Query': z
      .looseObject({
        '@role': optionalText,
        '@searchTerms': optionalText,
        '@startPage': optionalText,
      })
      .nullable()
      .optional(),
    link: z.array(linkSchema).nullable().optional(),
    entry: z.array(entrySchema).nullable().optional(),
  }),
});
