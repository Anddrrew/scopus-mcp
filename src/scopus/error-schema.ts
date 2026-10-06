import Type from 'typebox';
import { defineSchema } from '../schemas/schema';

// Unknown error fields are accepted. Only documented code/message fields are
// selected for the public error, and errors.ts redacts credentials from them.
export const errorBodySchema = defineSchema(
  Type.Object(
    {
      'service-error': Type.Optional(
        Type.Object(
          {
            status: Type.Object(
              {
                statusCode: Type.Optional(
                  Type.String({ description: 'Elsevier service error code.' }),
                ),
                statusText: Type.Optional(
                  Type.String({
                    description: 'Elsevier service error message.',
                  }),
                ),
              },
              {
                additionalProperties: true,
                description: 'Status details from an Elsevier service error.',
              },
            ),
          },
          {
            additionalProperties: true,
            description: 'Elsevier service error envelope.',
          },
        ),
      ),
      'error-response': Type.Optional(
        Type.Object(
          {
            errorCode: Type.Optional(
              Type.String({ description: 'Elsevier gateway error code.' }),
            ),
            errorMessage: Type.Optional(
              Type.String({ description: 'Elsevier gateway error message.' }),
            ),
          },
          {
            additionalProperties: true,
            description: 'Elsevier gateway error envelope.',
          },
        ),
      ),
    },
    {
      additionalProperties: true,
      description:
        'Known Elsevier error envelopes used to extract a redacted public error.',
    },
  ),
);
