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

## CI and releases

PRs targeting `main` run ESLint, type checking, build, stdio tests, and npm
packaging checks on Node 22.22.0 and 24. Develop on `feature/*` or `fix/*` branches.

Releases are tags on `main`; no release branch is needed:

1. Update the version with `npm version 0.1.0 --no-git-tag-version` (use the
   intended version) and merge both package files through a PR.
2. In GitHub Actions, select **Release → Run workflow**, choose `main`, and enter
   the exact version without `v`. Leave **dry_run** enabled to validate first.
3. Once npm access is configured, run again with **dry_run** disabled. The workflow
   checks the selected main commit, creates `v<version>`, publishes the built npm
   archive with provenance to `latest`, and creates a GitHub release with notes.

Publishing uses [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
(OIDC). Before the first automated publication, ensure the npm package name is
available/owned by you and configure its trusted publisher: owner `Anddrrew`,
repository `scopus-mcp`, workflow `release.yml`, no environment, with direct
publishing allowed. If npm requires an initial manual publication before package
settings are available, bootstrap it manually, then use this workflow for the
next version. No npm token is stored in this repository.

Only stable versions are accepted. A tag on another commit is rejected. If npm
publication fails, fix the publisher configuration and rerun the same workflow
run; the existing tag is accepted only for the same commit. If npm succeeded but
GitHub release creation failed, create the GitHub release from that existing tag
instead of attempting to republish the immutable npm version.

The manual workflow becomes available after this change is merged into `main`.
Branch protection is configured separately in GitHub; this workflow alone does
not require passing checks before merging.

## API documentation

- [Scopus API specification](https://dev.elsevier.com/sc_api_spec.html)
- [Interactive Scopus APIs](https://dev.elsevier.com/scopus.html)

## License

MIT © 2026 Andrii Baran. The license covers this project's code. Access to Elsevier
APIs and use of Scopus data remain subject to Elsevier's terms. This is an
independent project, not an official Elsevier product.
