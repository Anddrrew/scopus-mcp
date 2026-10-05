import { z } from 'zod';

const nonBlank = z
  .string()
  .refine((value) => value.trim().length > 0, 'Must not be blank.');
export const inputSchema = z.strictObject({
  idType: z
    .enum(['doi', 'elsevierId', 'elsevierPii', 'isbn', 'pmcid', 'pmid'])
    .describe('The native PlumX identifier type.'),
  idValue: nonBlank
    .refine(
      (value) => value !== '.' && value !== '..',
      'An identifier cannot be a dot path segment.',
    )
    .describe(
      'Identifier value, e.g. 10.1103/physrevlett.116.061102. Supply the original value, not a URL-encoded string.',
    ),
  reqId: nonBlank
    .optional()
    .describe('Caller-supplied request identifier for Elsevier support.'),
});

const text = z.string().nullable().optional();
const total = z.number().nullable().optional();
const source = z.looseObject({ name: text, total });
const countType = z.looseObject({
  name: text,
  total,
  sources: z.array(source).nullable().optional(),
});
const category = z.looseObject({
  name: text,
  total,
  count_types: z.array(countType).nullable().optional(),
});

// Metric category/source names may evolve; retain unknown fields and partial metrics.
export const outputSchema = z.looseObject({
  id_type: z.string(),
  id_value: z.string(),
  count_categories: z.array(category).nullable().optional(),
});
