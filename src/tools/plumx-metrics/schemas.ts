import Type from 'typebox';
import { nonBlankString, optionalText } from '../../schemas/fields';
import { defineSchema } from '../../schemas/schema';

export const inputSchema = defineSchema(
  Type.Object(
    {
      idType: Type.Union(
        [
          Type.Literal('doi'),
          Type.Literal('elsevierId'),
          Type.Literal('elsevierPii'),
          Type.Literal('isbn'),
          Type.Literal('pmcid'),
          Type.Literal('pmid'),
        ],
        {
          description:
            'Identifier namespace used to locate the publication or artifact in PlumX.',
        },
      ),
      idValue: Type.String({
        pattern: '\\S',
        not: { enum: ['.', '..'] },
        description:
          'Identifier in the selected namespace, e.g. 10.1103/physrevlett.116.061102 for doi. Supply the original value without URL encoding; a lone . or .. is not allowed.',
      }),
      reqId: Type.Optional(
        nonBlankString(
          'Caller-supplied request identifier for tracing this request with Elsevier support.',
        ),
      ),
    },
    { additionalProperties: false },
  ),
);

const source = Type.Object(
  {
    name: optionalText('Name of the source contributing this metric.'),
    total: Type.Optional(
      Type.Union([Type.Number(), Type.Null()], {
        description: 'Metric count reported by this source, as a JSON number.',
      }),
    ),
  },
  { additionalProperties: true },
);

const countType = Type.Object(
  {
    name: optionalText('Name of the metric type within its category.'),
    total: Type.Optional(
      Type.Union([Type.Number(), Type.Null()], {
        description: 'Total count for this metric type, as reported by PlumX.',
      }),
    ),
    sources: Type.Optional(
      Type.Union([Type.Array(source), Type.Null()], {
        description:
          'Per-source breakdown for this metric type; may be absent or null.',
      }),
    ),
  },
  { additionalProperties: true },
);

const category = Type.Object(
  {
    name: optionalText(
      'PlumX metric category name; categories are not restricted to a fixed list.',
    ),
    total: Type.Optional(
      Type.Union([Type.Number(), Type.Null()], {
        description:
          'Total count for this metric category, as reported by PlumX.',
      }),
    ),
    count_types: Type.Optional(
      Type.Union([Type.Array(countType), Type.Null()], {
        description:
          'Metric types contributing to this category; may be absent or null.',
      }),
    ),
  },
  { additionalProperties: true },
);

// Metric names may evolve; preserve unknown fields and partial metrics.
export const outputSchema = defineSchema(
  Type.Object(
    {
      id_type: Type.String({
        description: 'Identifier namespace returned by PlumX.',
      }),
      id_value: Type.String({
        description: 'Identifier value returned by PlumX.',
      }),
      count_categories: Type.Optional(
        Type.Union([Type.Array(category), Type.Null()], {
          description:
            'Available PlumX metric categories and their counts; may be absent or null.',
        }),
      ),
    },
    { additionalProperties: true },
  ),
);
