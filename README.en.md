# NPM Publisher

A tool for NPM version management, tag management, mirror management, build automation, and automatic NPM package publishing for any project that needs to push to mirror repositories, including TS/JS libraries, component libraries, Monorepo libraries, etc.

## Features

1. Supports standard NPM version control and manual version specification
2. Supports configurable tag format and commit message format, with automatic tag and version log commits
3. Supports configurable package push directory and project root directory, usable in any independent project or Monorepo project
4. Supports quick beta version builds
5. Supports hot-plugging of task nodes, allowing selective task execution (e.g., skip build, skip version selection, skip push, skip tag commit, etc.)
6. Supports configuration file (build.config.json) with multiple mirror addresses and automatic mirror switching for NPM package publishing
7. Supports automated build resource execution after version updates and automatic push to specified mirror repositories
8. Supports any package manager: pnpm, yarn, npm, etc.
9. Supports repository version rollback

## Feature Demo

![record_3](https://github.com/user-attachments/assets/3a286ba7-e14a-472f-952e-5bd65009ecc7)

## Installation

```bash
pnpm add publisher-npm -D
```

## Quick Start

```base
publisher-npm run [--config /path/build.config.json] [--configIgnore] [--quickBeta] [--reverse] [--task] [-v] [-h]
```

### Parameter Description

- `--config` Optional parameter. When configured, specify the configuration file path. This will update the configuration based on the specified file. If not specified, it will automatically read the `build.config.json` file in the root directory
- `--configIgnore` Optional parameter. Whether to omit configuration. If the project only needs to support NPM mirror repositories, you can use this parameter without needing a `build.config.json` file
- `--quickBeta` Optional parameter. Whether to quickly build a beta version. By default, it does not build. When building, it uses the first mirror repository address to push the NPM package
- `--reverse` Optional parameter. Whether to perform version rollback. If enabled, you need to input the version number and select the repository for version rollback
- `--task` Optional parameter. Selectively execute task tasks. By default, all tasks are executed. Configure a string using "-" to connect tasks. Available options: selectTag, selectVersion, selectMirror, commitTag, build, publish. For example: --task selectVersion-build-publish, which only executes version selection + build + package push tasks

### Task Description

| Task Name     | Description                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| selectTag     | Select NPM tag for publishing, such as latest, beta, alpha, rc, private, etc. Supports custom input   |
| selectVersion | Select version number for publishing, such as patch, minor, major, etc. Supports manual version input |
| selectMirror  | Select mirror repository address for publishing                                                       |
| commitTag     | Commit Git tag and version change log                                                                 |
| build         | Execute build command to generate release package                                                     |
| publish       | Publish NPM package to selected mirror repository                                                     |

Example: `--task selectVersion-build-publish` means only executing version selection, build, and package push tasks, skipping other tasks.

### Add Configuration File

Add configuration file in project root directory: `build.config.json`

> If the configuration file is not in the project root directory, you need to use --config to specify the configuration path

Configuration parameters:

- buildScript: Package build command
- buildDir: Base path for package build, default is project root directory. Specify if you need to push resources from other directories
- projectDir: Project root directory. In Monorepo projects, you need to specify the subpackage directory. Default is current project root directory
- packager: Package manager used by the project. Default is pnpm, supporting pnpm, yarn, npm, and other mainstream package managers
- mirrorMap: Specify multiple mirror lists, needs to be specified in Key/Value format. By default, it will merge with NPM mirrors and display Key selection options during publishing
- tagName: Tag name, where "%s" will be automatically filled with version information during build, "%n" will be automatically filled with package.json name
- projectName: Project name, displayed in output logs
- commitMessage: After version generation, corresponding git commit and tag commit information will be created, where "%s" will be automatically filled with version information, "%n" will be automatically filled with package.json name

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

## Configuration

Configure build commands in the project's `package.json` file:

```json
{
  "scripts": {
    "publish:beta": "publisher-npm run --config ./build.config.json --quickBeta",
    "publish:release": "publisher-npm run --config ./build.config.json",
    "reverse": "publisher-npm run --reverse"
  }
}
```

## Usage

Run build script:

```bash
# Quick build beta version
$ pnpm publish:beta
```

```bash
# Build Release version
$ pnpm publish:release
```

```bash
# Rollback version
$ pnpm reverse
```

```bash
# Add parameters dynamically during execution
$ pnpm publish:release --task selectVersion-build-publish
```

## License

Copyright (c) 2025. Licensed under the MIT license.

## Author

Jinghui Luo - luojinghui424@gmail.com
