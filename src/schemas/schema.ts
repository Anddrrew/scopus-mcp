import {
  fromJsonSchema,
  type StandardSchemaV1,
  type StandardSchemaWithJSON,
} from '@modelcontextprotocol/server';
import type { Static, TSchema } from 'typebox';

/** Use the same JSON Schema for MCP discovery and runtime validation. */
export function defineSchema<T extends TSchema>(
  document: T,
  check?: (value: Static<T>) => string | undefined,
): StandardSchemaWithJSON<Static<T>, Static<T>> {
  const schema = fromJsonSchema<Static<T>>(document);
  if (!check) {
    return schema;
  }

  // Reserve this hook for rules JSON Schema cannot express, such as arithmetic
  // across two fields. Describe those rules in the published field descriptions.
  return {
    '~standard': {
      ...schema['~standard'],
      async validate(value) {
        const result = await validateSchema(schema, value);
        if (result.issues) {
          return result;
        }
        const message = check(result.value);
        return message ? { issues: [{ message }] } : result;
      },
    },
  };
}

/** Validate without coercing values, inserting defaults, or removing fields. */
export async function validateSchema<Input, Output>(
  schema: StandardSchemaV1<Input, Output>,
  value: unknown,
): Promise<StandardSchemaV1.Result<Output>> {
  return schema['~standard'].validate(value);
}
