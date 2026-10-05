import { z } from 'zod';

const nonBlank = z
  .string()
  .refine((value) => value.trim().length > 0, 'Must not be blank.');
const identifier = nonBlank.refine(
  (value) => !/^\.+$/.test(value.trim()) && !value.includes(','),
  'Provide one identifier that does not consist only of dots.',
);

export const inputSchema = z
  .strictObject({
    affiliation_id: identifier
      .optional()
      .describe(
        'One Scopus affiliation ID. Provide exactly one of affiliation_id or eid.',
      ),
    eid: identifier
      .optional()
      .describe(
        'One affiliation electronic ID. Use instead of affiliation_id.',
      ),
    view: z
      .enum(['BASIC', 'LIGHT', 'STANDARD', 'DOCUMENTS', 'AUTHORS', 'ENTITLED'])
      .optional()
      .describe(
        'Response view (API default: LIGHT); availability depends on entitlements.',
      ),
    field: nonBlank
      .optional()
      .describe(
        'Comma-separated response fields; unavailable with DOCUMENTS and AUTHORS views.',
      ),
    startref: z
      .int()
      .min(0)
      .optional()
      .describe('Zero-based result offset for related documents or authors.'),
    refcount: z
      .int()
      .min(0)
      .optional()
      .describe(
        'Number of related documents or authors; limits depend on API service level.',
      ),
    reqId: nonBlank
      .optional()
      .describe('Caller-supplied request identifier for Elsevier support.'),
    ver: nonBlank.optional().describe('Elsevier resource version.'),
  })
  .superRefine((input, ctx) => {
    if ((input.affiliation_id === undefined) === (input.eid === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['affiliation_id'],
        message: 'Provide exactly one of affiliation_id or eid.',
      });
    }
    if (
      input.field !== undefined &&
      (input.view === 'DOCUMENTS' || input.view === 'AUTHORS')
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['field'],
        message: 'field cannot be combined with DOCUMENTS or AUTHORS views.',
      });
    }
  });

const optionalText = z.string().nullable().optional();
const profile = z.looseObject({
  coredata: z
    .looseObject({
      'dc:identifier': optionalText,
      'prism:url': optionalText,
      eid: optionalText,
      'author-count': optionalText,
      'document-count': optionalText,
    })
    .nullable()
    .optional(),
  'affiliation-name': optionalText,
  city: optionalText,
  country: optionalText,
});

// Preserve partial profiles and view-specific content without normalizing
// Elsevier's strings, nulls, unknown fields, or object/array cardinality.
export const outputSchema = z.looseObject({
  'affiliation-retrieval-response': z
    .union([profile, z.array(profile)])
    .nullable(),
});
