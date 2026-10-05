import { z } from 'zod';

const nonBlank = z
  .string()
  .refine((value) => value.trim().length > 0, 'Must not be blank.');
const identifiers = nonBlank.refine(
  (value) =>
    value
      .split(',')
      .every((part) => part.trim().length > 0 && !/^\.+$/.test(part.trim())),
  'Identifiers must not be empty or consist only of dots.',
);

export const inputSchema = z
  .strictObject({
    author_id: identifiers
      .optional()
      .describe(
        'Scopus author ID, or comma-separated IDs for one native batch request. Use exactly one of author_id, eid, orcid.',
      ),
    eid: identifiers
      .optional()
      .describe(
        'Author electronic ID, or comma-separated IDs for one native batch request.',
      ),
    orcid: identifiers
      .optional()
      .describe(
        'One ORCID identifier. Retrieves the normal Scopus author JSON.',
      ),
    view: z
      .enum([
        'BASIC',
        'LIGHT',
        'STANDARD',
        'ENHANCED',
        'METRICS',
        'DOCUMENTS',
        'ENTITLED',
      ])
      .optional()
      .describe(
        'Response view (API default: LIGHT). DOCUMENTS requires a single identifier. Access depends on entitlements.',
      ),
    field: nonBlank.optional().describe('Comma-separated response fields.'),
    alias: z
      .boolean()
      .optional()
      .describe(
        'Single profiles only: false requests a superseded profile instead of its replacement (API default: true).',
      ),
    startref: z
      .int()
      .min(0)
      .optional()
      .describe(
        'Single profiles only: zero-based offset for related documents.',
      ),
    refcount: z
      .int()
      .min(0)
      .optional()
      .describe(
        'Single profiles only: number of related documents; API limits depend on service level.',
      ),
    reqId: nonBlank
      .optional()
      .describe('Caller-supplied request identifier for Elsevier support.'),
    ver: nonBlank.optional().describe('Elsevier resource version.'),
  })
  .superRefine((input, ctx) => {
    const selected = [input.author_id, input.eid, input.orcid].filter(
      (value) => value !== undefined,
    );
    if (selected.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['author_id'],
        message: 'Provide exactly one of author_id, eid, orcid.',
      });
    }
    if (input.orcid?.includes(',')) {
      ctx.addIssue({
        code: 'custom',
        path: ['orcid'],
        message: 'ORCID lookup accepts one identifier.',
      });
    }
    if ((input.author_id ?? input.eid)?.includes(',')) {
      if (input.view === 'DOCUMENTS') {
        ctx.addIssue({
          code: 'custom',
          path: ['view'],
          message: 'DOCUMENTS is supported only for a single author.',
        });
      }
      for (const key of ['alias', 'startref', 'refcount'] as const) {
        if (input[key] !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is supported only for a single author.`,
          });
        }
      }
    }
  });

const optionalText = z.string().nullable().optional();
const profile = z.looseObject({
  '@status': optionalText,
  coredata: z
    .looseObject({
      'dc:identifier': optionalText,
      'prism:url': optionalText,
      eid: optionalText,
      'document-count': optionalText,
      'citation-count': optionalText,
      'cited-by-count': optionalText,
    })
    .nullable()
    .optional(),
  'h-index': optionalText,
  'coauthor-count': optionalText,
});
const profiles = z.union([profile, z.array(profile)]).nullable();

// Elsevier uses a different envelope for native batch retrieval. Preserve both,
// including partial profiles, unknown fields, and single-object/array variants.
export const outputSchema = z
  .looseObject({
    'author-retrieval-response': profiles.optional(),
    'author-retrieval-response-list': z
      .looseObject({
        'author-retrieval-response': profiles.optional(),
      })
      .nullable()
      .optional(),
  })
  .refine(
    (value) =>
      value['author-retrieval-response'] !== undefined ||
      value['author-retrieval-response-list'] !== undefined,
    'Expected an Elsevier author retrieval response.',
  );
