import Type from 'typebox';
import { nonBlankString, optionalText } from '../../schemas/fields';
import { defineSchema } from '../../schemas/schema';

export const inputSchema = defineSchema(
  Type.Object(
    {
      description: Type.Optional(
        nonBlankString(
          'Case-insensitive partial match on the primary subject description, e.g. biological.',
        ),
      ),
      detail: Type.Optional(
        nonBlankString(
          'Case-insensitive partial match on the subject detail, e.g. food.',
        ),
      ),
      code: Type.Optional(
        nonBlankString('Exact subject classification code, e.g. 1106.'),
      ),
      abbrev: Type.Optional(
        nonBlankString(
          'Case-insensitive exact subject abbreviation, e.g. AGRI.',
        ),
      ),
      field: Type.Optional(
        Type.String({
          pattern:
            '^(?:code|abbrev|detail|description)(?:,(?:code|abbrev|detail|description))*(?![\\s\\S])',
          description:
            'Comma-separated response fields: code, abbrev, detail, description. Use exact names without spaces; omit to return all fields.',
        }),
      ),
    },
    { additionalProperties: false },
  ),
);

const classification = Type.Object(
  {
    code: optionalText('Scopus subject classification code, e.g. 1106.'),
    abbrev: optionalText('Abbreviation of the subject area, e.g. AGRI.'),
    detail: optionalText('Specific subject description, e.g. Food Science.'),
    description: optionalText(
      'Primary subject area description, e.g. Agricultural and Biological Sciences.',
    ),
  },
  { additionalProperties: true },
);

export const outputSchema = defineSchema(
  Type.Object(
    {
      'subject-classifications': Type.Object(
        {
          'subject-classification': Type.Optional(
            Type.Union(
              [classification, Type.Array(classification), Type.Null()],
              {
                description:
                  'Matching classifications: Elsevier may return a single object, an array, null, or omit this field.',
              },
            ),
          ),
          error: optionalText(
            'Message returned inside a successful response, such as No results found.',
          ),
        },
        {
          additionalProperties: true,
          description:
            'Native Elsevier subject classification response, including any no-results message.',
        },
      ),
    },
    { additionalProperties: true },
  ),
);
