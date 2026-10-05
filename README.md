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

Launch the npm package over stdio with `npx -y scopus-mcp`. In an MCP client,
set `command` to `npx`, `args` to `["-y", "scopus-mcp"]`, and supply the same
Elsevier environment variables shown above.

## CI and releases

PRs targeting `main` run ESLint, formatting checks, type checking, build, stdio tests, and npm
packaging checks on the latest available Node 24 release. Develop on `feature/*` or `fix/*` branches.

Releases are tags on `main`. Version changes go through a short-lived release PR,
so the workflow works with a protected `main` that requires pull requests:

1. Merge the changes you want to release into `main`.
2. In GitHub Actions, select **Release → Run workflow**, choose `main`, and select
   `patch` (default), `minor`, or `major`. For example, from `0.1.0` these produce
   `0.1.1`, `0.2.0`, and `1.0.0` respectively.
3. Leave **dry_run** enabled to validate the next version and archive without
   changing the repository or publishing. This does not verify npm publish access.
4. Run with **dry_run** disabled to open a `release/v<version>` PR updating
   `package.json` and `package-lock.json`. If a release PR is already open, the
   workflow links to it instead of preparing another one.
5. On the release PR, select **Approve workflows to run** if GitHub requests it,
   then merge after CI passes. Merging starts the **Release** workflow again,
   which checks and builds the merge commit, pushes its version tag, publishes to
   npm `latest`, and creates the GitHub release.

In GitHub **Settings → Actions → General → Workflow permissions**, enable
**Allow GitHub Actions to create and approve pull requests**. The default token
permissions can remain read-only: this workflow requests the specific write
permissions it needs. It creates PRs but does not approve or merge them.
PR checks started by `GITHUB_TOKEN` require a maintainer's approval to run.
See [GitHub's token event rules](https://docs.github.com/en/actions/concepts/security/github_token).

The workflow never pushes directly to `main`. It publishes only merged release
PRs from this repository whose branch name matches the package version. A merge
of an ordinary PR, an unmerged closed PR, or a fork PR does not publish anything.
Publication uses the release PR's merge commit even if `main` advances afterward.

Publishing uses [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
(OIDC). Configure the npm package's trusted publisher: owner `Anddrrew`,
repository `scopus-mcp`, workflow `release.yml`, no environment, with direct
publishing allowed. No npm token is stored in this repository.

Only stable versions are accepted. If publication fails, fix the cause and rerun
the failed **Release** run for the merged PR. The workflow reuses a tag only when
it points to the same merge commit, and skips npm publication only when the
registry already contains the exact archive. It also preserves an existing
GitHub release. Do not start another version bump to retry publication.

After changing this workflow, start a new manual run from the updated `main`;
rerunning an older failed run still uses the old workflow revision.

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
