import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfig } from '../src/config.js';

await test('credentials are read only from explicit Elsevier environment variables', () => {
  assert.deepEqual(readConfig({}), {});
  assert.deepEqual(
    readConfig({ ELSEVIER_API_KEY: ' ', ELSEVIER_INST_TOKEN: '' }),
    {},
  );
  assert.deepEqual(
    readConfig({
      ELSEVIER_API_KEY: ' key ',
      ELSEVIER_INST_TOKEN: ' token ',
      OTHER: 'ignored',
    }),
    {
      apiKey: 'key',
      instToken: 'token',
    },
  );
});
