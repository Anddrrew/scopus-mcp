# scopus-mcp

A TypeScript MCP server for the Elsevier Scopus API, using stdio.

Currently implements `scopus_search`: one MCP tool for the Scopus Search API.
Parameters and JSON responses follow Elsevier's format, including namespaced
keys such as `dc:title` and string values such as `citedby-count`.

## Development

Requires Node.js >=22.22.0 and npm.

```sh
npm ci
npm run dev
```

The process waits for MCP messages on stdin. Stdout is reserved for the protocol;
write diagnostics to stderr only.

```sh
npm run check         # ESLint, Prettier, typecheck, build, offline tests
npm run lint:fix      # Apply available ESLint fixes
npm run format        # Format supported files with Prettier
npm run format:check  # Check formatting without changing files
npm run build
npm start
```

ESLint checks TypeScript with type information and validates JSON files.
Prettier handles formatting separately, using two-space indentation, an
80-character print width, and single quotes in TypeScript. It preserves
intentionally multiline objects. Generated files and the lockfile are excluded
from formatting.

Husky installs a pre-push hook during `npm ci` / `npm install`. Every push runs
`npm run check`. Source, tests, and ESLint configuration use TypeScript.

Code is in `src/`: startup in `index.ts`, tool registration in `server.ts`,
environment configuration in `config.ts`, shared HTTP code in `scopus/`, and
tool handlers/schemas in `tools/<tool-name>/`. Tests mirror these areas under
`test/`, with shared helpers in `test/helpers/` and synthetic Elsevier-shaped
responses in `test/fixtures/`. Tests make no live Scopus requests and need no key.
Local TypeScript imports omit file extensions; ESLint enforces this convention.
`npm run build` checks types, clears `dist`, and uses esbuild to bundle the CLI as
Node ESM, keeping npm dependencies external. Tests run the source through `tsx`.
`npm test` builds first; `npm run test:run` uses the existing build.

## Local MCP client configuration

Build first, then configure your MCP client:

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

Obtain a key from the [Elsevier Developer Portal](https://dev.elsevier.com/).
Set `ELSEVIER_INST_TOKEN` alongside it if your institution provides one. Both
credentials are sent in HTTP headers and never accepted as tool arguments.
The server can start and list tools without a key; a search then returns a
`MISSING_API_KEY` tool error. Environment files are not loaded automatically.

## Scopus Search

`scopus_search` calls `GET https://api.elsevier.com/content/search/scopus` and
returns one page per invocation. Example tool arguments:

```json
{
  "query": "TITLE-ABS-KEY(machine learning) AND PUBYEAR > 2020",
  "view": "STANDARD",
  "count": 25,
  "sort": "-coverDate"
}
```

| Parameter          | Meaning                                                                           |
| ------------------ | --------------------------------------------------------------------------------- |
| `query`            | Required native Scopus query string                                               |
| `view`             | `STANDARD` (default), `COMPLETE`, or `COMPONENT`                                  |
| `count`            | Page size, default 25; max 200 for STANDARD or 25 for COMPLETE/COMPONENT          |
| `start`            | Zero-based offset; the requested window must fit within 5000 results              |
| `cursor`           | Cursor pagination: `*` first, then `search-results.cursor["@next"]`; omit `start` |
| `date`             | Year or range, e.g. `2020-2026`                                                   |
| `sort`             | API sort expression, e.g. `-coverDate,+creator`                                   |
| `field`            | Comma-separated response fields; overrides `view`                                 |
| `subj`             | Subject area code, e.g. `COMP`                                                    |
| `facets`           | API facet expression, e.g. `pubyear;subjarea(count=10,sort=fd)`                   |
| `content`          | `all`, `core`, or `dummy`                                                         |
| `alias`            | Include superseded author profiles in author-ID searches                          |
| `suppressNavLinks` | Suppress top-level navigation links                                               |
| `reqId`            | Request identifier for Elsevier support                                           |
| `ver`              | Resource-version flags such as `new` or `facetexpand`                             |

Keep the same query and options when requesting the next page. Navigation links
and cursor tokens are preserved as returned by Elsevier; the tool does not
automatically fetch additional pages. View/cursor access depends on your API
key and institutional entitlements. With `field`, Elsevier decides the effective
view and limit. The tool always requests JSON.

The original `search-results` object is returned in MCP `structuredContent`,
with an `outputSchema`, and also serialized as text for MCP client compatibility.
Unknown fields are retained, absent fields stay absent, and numbers represented
as strings stay strings. Empty result entries (including Elsevier's `error`
marker for an empty result set) are preserved rather than converted.

Available `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` and
`Retry-After` headers are returned separately under MCP `_meta["scopus-mcp/headers"]`.
Quota headers are optional and their values remain strings.

HTTP failures return `isError: true` with a text JSON error containing `code`,
`message`, and HTTP `status` when available. JSON API error messages are retained
with credentials redacted; non-JSON failures use a message based on HTTP status.
Requests have a 30-second timeout, support MCP cancellation, and are not retried
automatically. Missing credentials, timeouts, network failures, and invalid
upstream JSON have distinct error codes. Invalid arguments are rejected before
making a request.

## npm packaging

```sh
npm pack
```

The prepack script checks types and builds the CLI. The package includes the bundled CLI,
README, and license. It exposes the `scopus-mcp` executable.

After publication under the final npm package name, clients can use `npx -y
<package-name>` as the command and arguments. This project is not published yet;
package-name availability must be checked before release.

## CI and releases

PRs targeting `main` run ESLint, formatting checks, type checking, build, stdio tests, and npm
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
- [Scopus Search parameters](https://dev.elsevier.com/documentation/SCOPUSSearchAPI.wadl)
- [Scopus Search response views](https://dev.elsevier.com/sc_search_views.html)
- [API limits and quota headers](https://dev.elsevier.com/api_key_settings.html)

## License

MIT © 2026 Andrii Baran. The license covers this project's code. Access to Elsevier
APIs and use of Scopus data remain subject to Elsevier's terms. This is an
independent project, not an official Elsevier product.
