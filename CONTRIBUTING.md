# Contributing

For bug reports, include the package and Node.js versions, MCP client, steps to
reproduce, and relevant errors. Remove credentials and private data from reports
and test fixtures.

## Local setup

Requires Node.js >=22.22.0 and npm. CI runs on the latest Node.js 24 release.

```sh
git clone https://github.com/Anddrrew/scopus-mcp.git
cd scopus-mcp
npm ci
npm run check
```

`npm ci` installs the Husky pre-push hook, which runs `npm run check`. Tests use
synthetic API responses and run offline without credentials.

| Command                  | Purpose                                                   |
| ------------------------ | --------------------------------------------------------- |
| `npm run dev`            | Start the stdio server from TypeScript.                   |
| `npm run build`          | Typecheck and bundle the CLI into `dist/`.                |
| `npm start`              | Start the built CLI.                                      |
| `npm test`               | Build and run tests.                                      |
| `npm run test:run`       | Run tests against an existing build.                      |
| `npm run lint:fix`       | Apply ESLint fixes.                                       |
| `npm run format`         | Format code and documentation.                            |
| `npm run check`          | Run lint, formatting checks, typecheck, build, and tests. |
| `npm pack --dry-run`     | Build and inspect the package contents.                   |
| `npm run registry:check` | Check npm and MCP Registry identity and versions.         |

To use a local build, run `npm run build` and configure your MCP client:

```json
{
  "mcpServers": {
    "scopus": {
      "command": "node",
      "args": ["/absolute/path/to/scopus-mcp/dist/index.js"],
      "env": {
        "ELSEVIER_API_KEY": "your-elsevier-api-key"
      }
    }
  }
}
```

See [Configuration](README.md#configuration) for credentials. The stdio server
waits for MCP messages on stdin; send diagnostics to stderr.

## Project structure

```text
src/
  index.ts                  # Stdio startup
  server.ts                 # Tool registration
  config.ts                 # Environment configuration
  schemas/
    fields.ts               # Reusable native JSON field builders
    schema.ts               # TypeBox-to-MCP adapter and validation
  scopus/                   # Shared HTTP client and errors
  tools/<tool-name>/
    tool.ts                 # Registration and request handling
    schemas.ts              # TypeBox input/output schemas and descriptions
test/
  *.test.ts                 # Configuration and compiled stdio tests
  schemas/                  # Shared validation and published schema contracts
  scopus/                   # HTTP client and API error tests
  tools/                    # Tool tests through MCP
  helpers/                  # Test utilities
  fixtures/<tool-name>/     # Synthetic API responses
docs/
  tools/                    # Tool references
  releases.md               # Release instructions
scripts/                    # Build and release metadata utilities
server.json                 # Public MCP Registry installation metadata
```

Use TypeScript with extensionless relative imports. Keep types, helpers, and
builders near their consumers; share code when multiple tools need it.

## Schemas and validation

Use TypeBox to build JSON Schema and `defineSchema` from `src/schemas/schema.ts`
to register it with MCP. The SDK's `fromJsonSchema` adapter validates the same
document that clients receive through `tools/list`. TypeScript types are inferred
from the TypeBox definition; do not maintain a separate interface for its fields.

- Describe every input and output property, including nested fields. Explain the
  field's meaning, native representation, and relevant limits or interactions.
  Keep descriptions next to the field and align them with the API documentation.
- Use `additionalProperties: false` for inputs and `true` for open API response
  objects. Preserve unknown response fields, string counts, and native envelopes.
- An optional field may be absent; a nullable field may explicitly contain
  `null`. Preserve this distinction with `Type.Optional` and
  `Type.Union([schema, Type.Null()])`. `optionalText(description)` handles the
  common optional, nullable text fields.
- Encode portable rules in JSON Schema: `pattern`, numeric bounds, `oneOf` for
  alternative required identifiers, and `if`/`then` or `not` for parameter
  combinations. Keep custom JavaScript checks only for rules such as sums across
  fields, and describe those rules in the schema. `defineSchema` accepts an
  optional check for this purpose, after structural validation.
- JSON Schema `default` is documentation, not an instruction to mutate input.
  Apply server defaults explicitly when constructing request parameters; leave
  API-managed defaults absent. Validation does not coerce or remove values.
- Validate upstream JSON with `validateSchema` before returning it, so malformed
  responses retain the tool's `INVALID_RESPONSE` error contract.

Tests must exercise tools through MCP with mocked HTTP, including invalid inputs
that never reach HTTP, defaults and boundaries, and native response preservation.
Test cross-field rules against the schemas returned by `tools/list`, too.
`test/schemas/contracts.test.ts` independently validates every advertised schema
against JSON Schema 2020-12 and checks descriptions and the nullable/open-object
forms that previously caused Inspector warnings.

For an additional manual check with MCP Inspector after building:

```sh
npx --yes @modelcontextprotocol/inspector@2.9.0 --cli node dist/index.js --method tools/list --strict
```

This lists and checks schemas without calling Elsevier or requiring an API key.

## Adding a tool

1. Check endpoints, parameters, views, and examples in the
   [official API specification](https://dev.elsevier.com/sc_api_spec.html).
2. Add `tool.ts` and `schemas.ts` under `src/tools/<tool-name>/`, then register
   the tool in `src/server.ts`.
3. Preserve native parameter names and JSON structure. Use strict input schemas
   and output schemas that allow extra fields and optional data.
4. Make one request through the shared HTTP client, passing the cancellation
   signal. Keep credentials in server configuration and pagination explicit.
   Follow the [response and error contract](README.md#responses-and-errors).
5. Test through MCP with mocked HTTP: request parameters, response preservation,
   invalid input, upstream errors, and relevant empty, partial, or batch results.
   Include a compiled stdio test.
6. Document parameters, examples, and limits in `docs/tools/` and add the tool to
   the README table.
7. Run `npm run check` and `npm pack --dry-run --ignore-scripts` before pushing.

## Pull requests

Branch from `main` using `feature/<name>` or `fix/<name>`. Keep each API module
in a separate PR with its tests and documentation. Describe the behavior, API
reference, and validation. CI runs its checks in one sequential job.

Leave version changes to the [release workflow](docs/releases.md).
