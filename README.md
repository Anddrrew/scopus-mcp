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
packaging checks on the latest available Node 24 release. Develop on `feature/*` or `fix/*` branches.

Releases are tags on `main`; no release branch is needed:

1. Merge the changes you want to release into `main`.
2. In GitHub Actions, select **Release → Run workflow**, choose `main`, and select
   `patch` (default), `minor`, or `major`. For example, from `0.1.0` these produce
   `0.1.1`, `0.2.0`, and `1.0.0` respectively.
3. Leave **dry_run** enabled to update the version only in the temporary runner,
   run the checks, and validate the archive. No commit, tag, or publication is made.
4. Once npm access is configured, start a new run with **dry_run** disabled. It
   updates both package files, runs all checks, builds the archive, commits the
   version to `main`, tags that commit, publishes to npm `latest`, and creates a
   GitHub release. You do not need to edit the version manually.

The workflow uses the selected main commit. If main advances before preparation
or while checks run, the release fails instead of overwriting newer changes;
start a new run from main. The version commit and tag are pushed atomically.
Repository rules must permit the workflow bot to push the version commit to main.

Publishing uses [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
(OIDC). Before the first automated publication, ensure the npm package name is
available/owned by you and configure its trusted publisher: owner `Anddrrew`,
repository `scopus-mcp`, workflow `release.yml`, no environment, with direct
publishing allowed. If npm requires an initial manual publication before package
settings are available, bootstrap it manually, then use this workflow for the
next version. No npm token is stored in this repository.

Only stable versions are accepted. If a release fails after the version commit
and tag were pushed, those refs remain in place. Do not start another bump to
recover that version: check npm first, then finish publication from the existing
tag (or create only the GitHub release if npm publication succeeded). Re-running
the original workflow is rejected because main has moved to the version commit.
An npm version that was already published cannot be published again.

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
