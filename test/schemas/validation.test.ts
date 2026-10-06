import assert from 'node:assert/strict';
import { test } from 'node:test';
import Type from 'typebox';
import { defineSchema, validateSchema } from '../../src/schemas/schema';

await test('schema validation preserves data and keeps defaults explicit', async () => {
  const schema = defineSchema(
    Type.Object(
      {
        count: Type.Optional(Type.Integer({ default: 25 })),
        text: Type.Union([Type.String(), Type.Null()]),
      },
      { additionalProperties: true },
    ),
  );
  const value = { text: null, extra: { values: [1, '2', null] } };
  const original = structuredClone(value);
  const result = await validateSchema(schema, value);
  assert.equal(result.issues, undefined);
  assert.deepEqual(result.value, original);
  assert.deepEqual(value, original);
  assert.equal(Object.hasOwn(result.value ?? {}, 'count'), false);
  assert.ok((await validateSchema(schema, { text: null, count: '25' })).issues);
  assert.ok((await validateSchema(schema, { text: 25 })).issues);
});

await test('additional runtime rules run only after structural validation succeeds', async () => {
  let checks = 0;
  const schema = defineSchema(
    Type.Object(
      {
        start: Type.Integer({ minimum: 0 }),
        count: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: false },
    ),
    ({ start, count }) => {
      checks++;
      return start + count > 5 ? 'Page exceeds the result window.' : undefined;
    },
  );
  assert.ok((await validateSchema(schema, { start: 'bad', count: 1 })).issues);
  assert.equal(checks, 0);
  assert.ok((await validateSchema(schema, { start: 4, count: 2 })).issues);
  assert.equal(
    (await validateSchema(schema, { start: 4, count: 1 })).issues,
    undefined,
  );
  assert.equal(checks, 2);
});
