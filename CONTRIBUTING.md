# Contributing

Use Node.js 22.22.0 or newer and npm. CI uses Node.js 24.

```sh
git clone https://github.com/Anddrrew/scopus-mcp.git
cd scopus-mcp
npm ci
npm run check
```

`npm run check` runs lint, formatting checks, typecheck, build, and tests. The
pre-push hook runs it too. Tests use mocked API responses and need no credentials.

## Running locally

- `npm run dev` starts the server from TypeScript.
- `npm run build` builds the CLI; `npm start` runs it.
- `npm test` builds and runs the tests.

To connect a local build, replace `command` and `args` in the
[README configuration](README.md#quick-start) with:

```json
{
  "command": "node",
  "args": ["/absolute/path/to/scopus-mcp/dist/index.js"]
}
```

Keep credentials in the client's `env`. The server uses stdin/stdout for MCP;
write logs to stderr.

## Making changes

Branch from `main` using `feature/<name>` or `fix/<name>`. Use TypeScript with
extensionless relative imports.

- `src/tools/<tool-name>/` contains each tool's handler and TypeBox schemas.
- `src/server.ts` registers the tools.
- `src/scopus/` contains the shared HTTP client; `src/schemas/` has schema helpers.
- `test/` contains tests, helpers, and API fixtures; `docs/tools/` has tool references.

When adding a tool, follow an existing one: describe input and output fields,
keep Elsevier's parameter names and JSON responses, and use the shared HTTP
client. Test the request, response, and relevant error cases through MCP with
mocked HTTP. Add a short reference in `docs/tools/` and link it from the README.

In a PR, explain what changed and how you checked it. Leave version bumps to the
[release workflow](docs/releases.md).

For bugs, include the package version, MCP client, and steps to reproduce. Remove
API keys and private data from reports and fixtures.
