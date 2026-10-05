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

| Command              | Purpose                                                   |
| -------------------- | --------------------------------------------------------- |
| `npm run dev`        | Start the stdio server from TypeScript.                   |
| `npm run build`      | Typecheck and bundle the CLI into `dist/`.                |
| `npm start`          | Start the built CLI.                                      |
| `npm test`           | Build and run tests.                                      |
| `npm run test:run`   | Run tests against an existing build.                      |
| `npm run lint:fix`   | Apply ESLint fixes.                                       |
| `npm run format`     | Format code and documentation.                            |
| `npm run check`      | Run lint, formatting checks, typecheck, build, and tests. |
| `npm pack --dry-run` | Build and inspect the package contents.                   |

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
  scopus/                   # Shared HTTP client and errors
  tools/<tool-name>/
    tool.ts                 # Registration and request handling
    schemas.ts              # Input and output schemas
test/
  *.test.ts                 # Configuration and compiled stdio tests
  scopus/                   # HTTP client tests
  tools/                    # Tool tests through MCP
  helpers/                  # Test utilities
  fixtures/<tool-name>/     # Synthetic API responses
docs/
  tools/                    # Tool references
  releases.md               # Release instructions
```

Use TypeScript with extensionless relative imports. Keep types, helpers, and
builders near their consumers; share code when multiple tools need it.

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
