import Type from 'typebox';

/** Native text fields may be absent or explicitly null; preserve both cases. */
export function optionalText(description: string) {
  return Type.Optional(
    Type.Union([Type.String(), Type.Null()], { description }),
  );
}

/** Check for non-whitespace text without trimming the value sent to Elsevier. */
export function nonBlankString(description: string) {
  return Type.String({ pattern: '\\S', description });
}
