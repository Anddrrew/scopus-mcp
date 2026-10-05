# scopus-mcp

A TypeScript MCP server for the Elsevier Scopus API, using stdio.

Initial scaffold: the server supports MCP initialization and ping. Scopus tools
and structured response schemas will be added next. No API key is needed yet.

## Development

Requires Node.js >=22.22.0 and npm.

```sh
npm ci
npm run dev
```

The process waits for MCP messages on stdin. Stdout is reserved for the protocol;
write diagnostics to stderr only.

```sh
npm run check     # ESLint, typecheck, build, stdio smoke test
npm run build
npm start
```

Husky installs a pre-push hook during `npm ci` / `npm install`. Every push runs
`npm run check`. Source, tests, and ESLint configuration use TypeScript.

## Local MCP client configuration

Build first, then configure your MCP client:

```json
{
  "mcpServers": {
    "scopus": {
      "command": "node",
      "args": ["/absolute/path/to/scopus-mcp/dist/index.js"]
    }
  }
}
```

## npm packaging

```sh
npm pack
```

The prepack script compiles TypeScript. The package includes the compiled CLI,
README, and license. It exposes the `scopus-mcp` executable.

After publication under the final npm package name, clients can use `npx -y
<package-name>` as the command and arguments. This project is not published yet;
package-name availability must be checked before release.

## API documentation

- [Scopus API specification](https://dev.elsevier.com/sc_api_spec.html)
- [Interactive Scopus APIs](https://dev.elsevier.com/scopus.html)

## License

MIT © 2026 Andrii Baran. The license covers this project's code. Access to Elsevier
APIs and use of Scopus data remain subject to Elsevier's terms. This is an
independent project, not an official Elsevier product.
