# Releases

Releases are tags on `main`, published to npm as `latest` and listed in the
[official MCP Registry](https://registry.modelcontextprotocol.io/). The
[Release workflow](../.github/workflows/release.yml) prepares a version PR;
merging that PR triggers publication.

## Setup

In GitHub **Settings → Actions → General → Workflow permissions**, enable
**Allow GitHub Actions to create and approve pull requests**. Default token
permissions can remain read-only; the workflow requests the permissions it needs.

In the npm package settings, add a GitHub Actions
[trusted publisher](https://docs.npmjs.com/trusted-publishers/):

| Field                | Value                                      |
| -------------------- | ------------------------------------------ |
| Organization or user | `Anddrrew`                                 |
| Repository           | `scopus-mcp`                               |
| Workflow filename    | `release.yml`                              |
| Environment          | Leave empty                                |
| Allowed actions      | Allow direct publishing with `npm publish` |

Publishing uses OIDC; no npm token is needed in the repository.

MCP Registry publishing also uses GitHub OIDC through the workflow's existing
`id-token: write` permission. No additional secret or manual registration is
needed. The registry name is `io.github.Anddrrew/scopus-mcp`; it must match
`mcpName` in the npm package. The first Registry publication requires a new npm
release containing that field; previously published packages cannot be updated.

[`server.json`](../server.json) describes the npm package, stdio transport, and
the credentials users supply in their MCP client. It contains no credential
values. Both its server version and npm package version track `package.json`.

## Publish a version

1. Merge the changes to release into `main`.
2. In GitHub Actions, select **Release → Run workflow** on `main`. Choose
   `patch` (default), `minor`, or `major`.
3. Leave **dry_run** enabled to check the next version and package without
   publishing. This checks the build and Registry metadata, not npm or Registry
   publish access.
4. Run again with **dry_run** disabled. The workflow opens a
   `release/v<version>` PR updating `package.json`, `package-lock.json`, and
   `server.json`,
   or links to an existing release PR.
5. Select **Approve workflows to run** on the release PR if prompted, then merge
   after CI passes. GitHub requires this approval for
   [PRs created with `GITHUB_TOKEN`](https://docs.github.com/en/actions/concepts/security/github_token).

The workflow builds the release PR's merge commit, creates `v<version>`,
publishes to npm, publishes its metadata to the MCP Registry, and creates a
GitHub release. It uses that commit even if
`main` has since advanced. Only merged `release/v<version>` PRs from this
repository trigger publication; the branch and package versions must match.
Versions use stable `major.minor.patch` numbers.

Use a fresh manual run for each new release; reruns use the original workflow
revision.

## Retry a failed release

Fix the cause and rerun the failed **Release** run for the merged PR. The workflow
reuses a matching tag, skips an identical npm archive and matching active Registry
entry, and preserves an existing GitHub release. A conflicting tag, archive, or
Registry entry stops the run. If Registry publication fails after npm succeeds,
retry the same version rather than preparing another version bump.

## Registry metadata

```sh
npm run registry:check
```

This checks package identity and version consistency offline. Release preparation
runs `npm run registry:sync` after `npm version` to update both Registry versions;
merged release PRs must already be consistent.

PR checks and release runs also use the official `mcp-publisher validate`
command. This contacts the Registry's validation endpoint but does not publish
or authenticate. CI pins the publisher version and verifies its download's
SHA-256 in [the setup action](../.github/actions/setup-mcp-publisher/action.yml).
Update the version and checksum together when upgrading the publisher.

For the publication format and authentication, see the official
[publishing guide](https://modelcontextprotocol.io/registry/quickstart) and
[GitHub Actions guide](https://modelcontextprotocol.io/registry/github-actions).

## Inspect the package

```sh
npm pack --dry-run
```

This checks types, builds the CLI, and lists the package contents: `dist/`,
`README.md`, `LICENSE`, and package metadata. The executable is `scopus-mcp`.
