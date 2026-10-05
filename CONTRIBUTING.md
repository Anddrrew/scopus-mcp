# Contributing

Bug reports, documentation improvements, and focused pull requests are welcome.
For bugs, include the package version, Node.js version, MCP client, steps to
reproduce, and relevant errors. Remove API keys, institutional tokens, and private
data from reports and fixtures.

## Set up

Requires Node.js >=22.22.0 and npm. CI uses the latest Node.js 24 release.

```sh
git clone https://github.com/Anddrrew/scopus-mcp.git
cd scopus-mcp
npm ci
npm run check
```

`npm ci` installs a Husky pre-push hook that runs `npm run check`. Tests use
synthetic Elsevier-shaped fixtures, make no live API requests, and need no key.

| Command              | Purpose                                                   |
| -------------------- | --------------------------------------------------------- |
| `npm run dev`        | Run the TypeScript stdio server through `tsx`.            |
| `npm run build`      | Check types and bundle the CLI into `dist/`.              |
| `npm start`          | Run the built CLI.                                        |
| `npm run check`      | Run lint, formatting checks, typecheck, build, and tests. |
| `npm test`           | Build, then run all tests.                                |
| `npm run test:run`   | Run tests using the existing build.                       |
| `npm run lint:fix`   | Apply available ESLint fixes.                             |
| `npm run format`     | Format source and documentation.                          |
| `npm pack --dry-run` | Build and inspect the npm package contents.               |

## Project layout

```text
src/
  index.ts                  # Stdio startup
  server.ts                 # MCP server and tool registration
  config.ts                 # Environment configuration
  scopus/                   # Shared HTTP client and API errors
  tools/<tool-name>/
    tool.ts                 # Tool registration and request handling
    schemas.ts              # Input and output schemas
test/
  *.test.ts                 # Configuration and compiled stdio tests
  scopus/                   # HTTP client tests
  tools/                    # Tool tests through MCP
  helpers/                  # Shared test utilities
  fixtures/<tool-name>/     # Synthetic API JSON responses
docs/
  tools/                    # Parameters and examples for each tool
  releases.md               # Maintainer release instructions
```

Keep types, helpers, and builders near their consumers. Extract shared code when
multiple tools need it; avoid adding empty layers or a generic API framework.

## Adding a tool

1. Use the [official API specification](https://dev.elsevier.com/sc_api_spec.html)
   to check endpoints, parameters, views, and JSON examples.
2. Add the handler and schemas under `src/tools/<tool-name>/` and register the
   tool in `src/server.ts`.
3. Preserve native API parameter names and JSON structure. Use a strict input
   schema, allow unknown response fields, and keep optional fields optional.
   Credentials stay in server configuration. Request JSON through the shared
   client and pass through the MCP cancellation signal.
4. Keep each invocation to one API call, including endpoints that natively
   accept multiple identifiers. Pagination stays explicit. Return validated
   JSON in `structuredContent` with an `outputSchema` and a JSON text fallback;
   retain the common error and quota metadata contract in the README.
5. Test the tool through MCP with mocked HTTP: request paths and parameters,
   native response preservation, invalid inputs, upstream failures, and invalid
   response shapes. Include relevant partial, empty, or multiple-record results
   and verify registration through the compiled stdio server.
6. Add a reference under `docs/tools/` with an example, supported parameters,
   relevant limits, and links to the official API docs. Add the tool to the
   README table.
7. Run `npm run check` and `npm pack --dry-run --ignore-scripts` before pushing.

Use TypeScript for code, scripts, and tests. Relative TypeScript imports omit
file extensions. ESLint checks types and JSON; Prettier controls formatting.
The build bundles the CLI as Node ESM with npm dependencies kept external.
Never write diagnostics to stdout: it carries the MCP protocol.

## Try a local build in an MCP client

Run `npm run build`, then configure:

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

Add `ELSEVIER_INST_TOKEN` if needed. The server does not load `.env` files.
`npm run dev` also starts a stdio server and waits for MCP messages on stdin.

## Pull requests

Branch from `main` using `feature/<name>` or `fix/<name>`. Keep each API module
in a separate PR with its tests and documentation. Describe the resulting
behavior, the official API reference, and what was verified. PR checks run in
one sequential pipeline on Node.js 24.

Leave package versions unchanged: maintainers prepare releases separately.
See the [release guide](docs/releases.md).
