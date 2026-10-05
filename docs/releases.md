# Releases

Releases are tags on `main`, published to npm as `latest`. The
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

## Publish a version

1. Merge the changes to release into `main`.
2. In GitHub Actions, select **Release → Run workflow** on `main`. Choose
   `patch` (default), `minor`, or `major`.
3. Leave **dry_run** enabled to check the next version and package without
   publishing. This checks the build, not npm publish access.
4. Run again with **dry_run** disabled. The workflow opens a
   `release/v<version>` PR updating `package.json` and `package-lock.json`,
   or links to an existing release PR.
5. Select **Approve workflows to run** on the release PR if prompted, then merge
   after CI passes. GitHub requires this approval for
   [PRs created with `GITHUB_TOKEN`](https://docs.github.com/en/actions/concepts/security/github_token).

The workflow builds the release PR's merge commit, creates `v<version>`,
publishes to npm, and creates a GitHub release. It uses that commit even if
`main` has since advanced. Only merged `release/v<version>` PRs from this
repository trigger publication; the branch and package versions must match.
Versions use stable `major.minor.patch` numbers.

Use a fresh manual run for each new release; reruns use the original workflow
revision.

## Retry a failed release

Fix the cause and rerun the failed **Release** run for the merged PR. The workflow
reuses a matching tag, skips an identical npm archive, and preserves an existing
GitHub release. A conflicting tag or archive stops the run. Retry the same
version rather than preparing another version bump.

## Inspect the package

```sh
npm pack --dry-run
```

This checks types, builds the CLI, and lists the package contents: `dist/`,
`README.md`, `LICENSE`, and package metadata. The executable is `scopus-mcp`.
