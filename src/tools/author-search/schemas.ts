import { z } from 'zod';

const nonBlank = z
  .string()
  .refine((value) => value.trim().length > 0, 'Must not be blank.');

export const inputSchema = z
  .strictObject({
    query: nonBlank
      .optional()
      .describe(
        'Native author query, e.g. AUTHLASTNAME(Smith) AND AUTHFIRST(John). Ignored by Elsevier when co-author is supplied.',
      ),
    'co-author': z
      .string()
      .regex(/^\d+$/)
      .optional()
      .describe(
        'One Scopus author ID. Returns associated co-authors and takes precedence over query.',
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
        'Up to three comma-separated sort fields, e.g. -document-count,+surname.',
      ),
    facets: nonBlank
      .optional()
      .describe(
        'Native facet expression, e.g. affilcountry(count=10,sort=fd);active.',
      ),
    alias: z
      .boolean()
      .optional()
      .describe(
        'Whether author ID searches include superseding profiles (API default: true).',
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
        'Resource version flags: facetexpand, subjexpand, allexpand, new; comma or semicolon separated.',
      ),
  })
  .superRefine((input, ctx) => {
    if (input.query === undefined && input['co-author'] === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['query'],
        message: 'Provide query or co-author.',
      });
    }
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
const nameSchema = z.looseObject({
  surname: optionalText,
  'given-name': optionalText,
  initials: optionalText,
});
const affiliationSchema = z.looseObject({
  'affiliation-url': optionalText,
  'affiliation-id': optionalText,
  'affiliation-name': optionalText,
  'affiliation-city': optionalText,
  'affiliation-country': optionalText,
});
const subjectSchema = z.looseObject({
  '@abbr': optionalText,
  '@frequency': optionalText,
  $: optionalText,
});
const entrySchema = z.looseObject({
  'dc:identifier': optionalText,
  'prism:url': optionalText,
  eid: optionalText,
  orcid: optionalText,
  'document-count': optionalText,
  'preferred-name': nameSchema.nullable().optional(),
  'name-variant': z.array(nameSchema).nullable().optional(),
  'affiliation-current': z
    .union([affiliationSchema, z.array(affiliationSchema)])
    .nullable()
    .optional(),
  subject: z.array(subjectSchema).nullable().optional(),
  // Elsevier's views and expanded responses expose different subject representations.
  'subject-area': z.json().optional(),
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
