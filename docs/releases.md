# Releases

## Publish

1. Merge the changes into `main`.
2. Open [Actions → Release](https://github.com/Anddrrew/scopus-mcp/actions/workflows/release.yml)
   and select **Run workflow** on `main`. Choose `patch`, `minor`, or `major`,
   and disable `dry_run`.
3. The workflow opens a `release/v<version>` PR. Approve its workflow run if
   prompted, wait for CI, then merge.

The workflow updates versions automatically. Merging the PR creates the tag,
publishes to npm and the MCP Registry, and creates a GitHub release.

Leave `dry_run` enabled for a check without creating a PR or publishing.

## If a release fails

Check the failed step and rerun the failed **Release** run. It skips matching
artifacts that were already published; a conflict stops the run. Don't bump the
version just to retry publication.

Reruns use the original workflow revision. Start a fresh manual run for a new
release.

## Publishing setup

- GitHub must allow Actions to create pull requests under **Settings → Actions →
  General → Workflow permissions**.
- npm uses a [trusted publisher](https://docs.npmjs.com/trusted-publishers/): owner
  `Anddrrew`, repository `scopus-mcp`, workflow `release.yml`, no environment,
  with direct `npm publish` allowed.
- The MCP Registry uses GitHub OIDC. Keep `mcpName` in `package.json` and `name`
  in `server.json` set to `io.github.Anddrrew/scopus-mcp`.

Neither publisher needs a token stored in repository secrets.
