# NPM Publisher

A tool for NPM version management, tag management, mirror management, build automation, and automatic NPM package publishing—for TS/JS libraries, component libraries, Monorepo packages, and any project that publishes to npm registries.

> **AI / CI integration**: See [AGENTS.md](./AGENTS.md) for structured command contracts, error codes, retry strategies, and config schema.

## Features

1. Standard npm semver versioning with manual version override
2. Configurable tag and commit message templates; automatic git commit, tag, and push (`--notPush` for local-only commits)
3. Configurable publish directory and project root; works in standalone projects and Monorepo subpackages
4. Quick beta builds (`--quickBeta`)
5. Hot-pluggable task pipeline—skip build, version selection, publish, etc. as needed
6. Multiple mirror registries via `mirrorMap`
7. Auto-build after version bump, then publish to selected registry
8. Supports pnpm, yarn, npm, and other package managers
9. Unpublish (rollback) published versions
10. **Fail-fast on errors**: git, build, or publish failure aborts immediately with exit code 1
11. **Non-interactive flags**: `--mirrorType`, `--npmTag`, `--release` for CI and retry flows

## Installation

```bash
pnpm add publisher-npm -D
```

## Quick Start

```bash
publisher-npm run [options]
# or
node index.mjs run [options]
```

### CLI Options

| Option | Description |
| --- | --- |
| `--config <path>` | Config file path; defaults to `build.config.json` in project root |
| `--configIgnore` | Skip config file; use built-in defaults (npm public registry only) |
| `--quickBeta` | Quick beta: prerelease version + beta tag + first mirror in mirrorMap |
| `--reverse` | Unpublish a specific version |
| `--notPush` | Commit version changes locally without git push |
| `--task <tasks>` | Task chain joined by `-`; see table below |
| `--mirrorType <name>` | Skip mirror prompt, e.g. `XYLink`, `NPM` |
| `--npmTag <tag>` | Skip tag prompt, e.g. `latest`, `beta` |
| `--release <type>` | Skip version prompt, e.g. `patch`, `minor`, `1.4.1`, `current` |
| `-v, --version` | Print CLI version |

### Tasks

Default: `selectTag-selectVersion-selectMirror-commitTag-build-publish`

| Task | Description | CLI alternative |
| --- | --- | --- |
| `selectTag` | Choose npm dist-tag (latest/beta/…) | `--npmTag` |
| `selectVersion` | Choose semver strategy or manual version | `--release` |
| `selectMirror` | Choose registry mirror | `--mirrorType` |
| `commitTag` | Bump version + git commit/tag/push | — |
| `build` | Run `{packager} {buildScript}` | — |
| `publish` | Publish to selected registry | Requires mirrorType/npmTag |

Examples:

```bash
# Version select + build + publish only
pnpm publish:release -- --task selectVersion-build-publish

# Non-interactive full release
publisher-npm run \
  --config ./build.config.json \
  --npmTag latest \
  --release patch \
  --mirrorType XYLink
```

### Configuration: build.config.json

```json
{
  "buildScript": "build",
  "packager": "pnpm",
  "mirrorMap": {
    "Private": "https://private.mirror.com/"
  },
  "projectName": "Publisher NPM",
  "commitMessage": "feat: publish release version %n@%s [#000000]",
  "buildDir": ".",
  "projectDir": ".",
  "tagName": "%n@%s"
}
```

| Field | Description |
| --- | --- |
| `buildScript` | Script name in package.json, e.g. `build` |
| `buildDir` | Working directory for publish |
| `projectDir` | Directory containing package.json (Monorepo subpackage path) |
| `packager` | Package manager: pnpm / yarn / npm |
| `mirrorMap` | Mirror key → registry URL; merged with built-in `NPM: https://registry.npmjs.org/` |
| `tagName` | Git tag template; `%n` = package name, `%s` = version |
| `projectName` | Display name in logs |
| `commitMessage` | Git commit template; `%n` = package name, `%s` = version |

## package.json Scripts

```json
{
  "scripts": {
    "publish:beta": "publisher-npm run --config ./build.config.json --quickBeta",
    "publish:release": "publisher-npm run --config ./build.config.json",
    "publish:retry": "publisher-npm run --config ./build.config.json --task publish --mirrorType XYLink --npmTag latest",
    "reverse": "publisher-npm run --config ./build.config.json --reverse"
  }
}
```

## Usage

```bash
pnpm publish:beta      # Quick beta
pnpm publish:release   # Interactive release
pnpm reverse           # Unpublish
```

## Publish Failures and Retry

The tool **fail-fast** on git, build, or publish errors (exit code 1). It will **not** print success when publish fails.

### Common npm Errors

| Code | Meaning | Suggested fix |
| --- | --- | --- |
| E404 | No permission or package not found | Run `npm whoami`; verify package ownership; use private mirror |
| E403 | Permission denied | Check org permissions, 2FA, token scope |
| E401 | Not authenticated | `npm login` or configure `.npmrc` |
| E409 | Version already exists | Bump version |

### Version committed but publish failed

If `commitTag` succeeded but `publish` failed, package.json and git may already reflect the new version while the registry does not.

**Option 1 — Retry publish only (recommended, no version bump):**

```bash
publisher-npm run \
  --config ./build.config.json \
  --task publish \
  --mirrorType NPM \
  --npmTag latest
```

**Option 2 — Manual publish:**

```bash
pnpm publish --tag latest --access public \
  --registry https://registry.npmjs.org/ \
  --no-git-checks
```

**Option 3 — Revert and re-release:**

```bash
git revert HEAD
# then run full publish:release again
```

The tool prints these commands and fix suggestions automatically on failure.

## Pipeline

```
Check clean git → Load config → [Select tag/version/mirror] → Commit version → Build → Publish
```

## License

Copyright (c) 2025. Licensed under the MIT license.

## Author

Jinghui Luo — luojinghui424@gmail.com
