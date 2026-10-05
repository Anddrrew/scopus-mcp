# Releases

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

## Inspect the package locally

```sh
npm pack --dry-run
```

The prepack script checks types and builds the CLI. The npm package contains
`dist/`, `README.md`, `LICENSE`, and package metadata, and exposes the
`scopus-mcp` executable. Publishing is a maintainer operation; contributions
should not change the package version.
