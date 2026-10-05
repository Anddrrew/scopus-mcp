import { z } from 'zod';

const nonBlank = z
  .string()
  .refine((value) => value.trim().length > 0, 'Must not be blank.');
const fields = ['code', 'abbrev', 'detail', 'description'];

export const inputSchema = z.strictObject({
  description: nonBlank
    .optional()
    .describe('Case-insensitive partial match on the subject description.'),
  detail: nonBlank
    .optional()
    .describe('Case-insensitive partial match on the subject detail.'),
  code: nonBlank
    .optional()
    .describe('Exact subject classification code, e.g. 1106.'),
  abbrev: nonBlank
    .optional()
    .describe('Case-insensitive exact subject abbreviation, e.g. AGRI.'),
  field: nonBlank
    .refine(
      (value) => value.split(',').every((field) => fields.includes(field)),
      'Use comma-separated code, abbrev, detail, or description.',
    )
    .optional()
    .describe(
      'Comma-separated response fields: code, abbrev, detail, description.',
    ),
});

const optionalText = z.string().nullable().optional();
const classificationSchema = z.looseObject({
  code: optionalText,
  abbrev: optionalText,
  detail: optionalText,
  description: optionalText,
});

export const outputSchema = z.looseObject({
  'subject-classifications': z.looseObject({
    // Elsevier returns an object for one match and an array for several.
    'subject-classification': z
      .union([classificationSchema, z.array(classificationSchema)])
      .nullable()
      .optional(),
    error: optionalText,
  }),
});
