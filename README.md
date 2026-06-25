# NPM Publisher

针对 TS/JS 库、组件库、Monorepo 库等任何需推送镜像仓库的项目，提供 NPM 版本管理、Tag 管理、镜像管理、构建自动化和 NPM 包自动推送。

> **AI / CI 集成**：请参阅 [AGENTS.md](./AGENTS.md)（结构化命令契约、错误码、重试策略、配置 Schema）。

## English Documentation

For English documentation, see [README.en.md](./README.en.md).

## 功能

1. 基于 npm semver 标准版本管控，支持手动指定版本
2. 可配置 Tag / Commit 模板，自动 git commit、tag、push（`--notPush` 可仅本地提交）
3. 可配置推送目录与项目根目录，适用于独立项目与 Monorepo 子包
4. 快速 Beta 构建（`--quickBeta`）
5. Task 节点热插拔，按需跳过构建、版本选择、推送等步骤
6. 多镜像配置（`mirrorMap`），发布时选择目标 registry，或 `all` 发布到全部镜像
7. 版本更新后自动构建并推送
8. 支持 pnpm、yarn、npm 等包管理器
9. 支持撤销（unpublish）已发布版本
10. **发布失败 fail-fast**：git / build / publish 任一步失败即中断，exit code 1
11. **非交互参数**：`--mirrorType`、`--npmTag`、`--release`，便于 CI 与失败后重试

## 安装

```bash
pnpm add publisher-npm -D
```

## 快速开始

```bash
publisher-npm run [options]
# 或
node index.mjs run [options]
```

### CLI 参数一览

| 参数 | 说明 |
| --- | --- |
| `--config <path>` | 配置文件路径，默认读取根目录 `build.config.json` |
| `--configIgnore` | 忽略配置文件，使用内置默认（仅 NPM 公有源场景） |
| `--quickBeta` | 快速 Beta：prerelease 版本 + beta tag + mirrorMap 第一项 |
| `--reverse` | 撤销指定版本（unpublish） |
| `--notPush` | 版本变更仅本地 commit，不 push 到 remote |
| `--task <tasks>` | 任务链，用 `-` 连接，见下表 |
| `--mirrorType <name>` | 跳过镜像选择，如 `XYLink`、`NPM`、`all`（全部镜像） |
| `--npmTag <tag>` | 跳过 Tag 选择，如 `latest`、`beta` |
| `--release <type>` | 跳过版本选择，如 `patch`、`minor`、`1.4.1`、`current` |
| `-v, --version` | 打印 CLI 版本 |

### Task 任务

默认 task：`selectTag-selectVersion-selectMirror-commitTag-build-publish`

| Task | 说明 | CLI 替代 |
| --- | --- | --- |
| `selectTag` | 选择 npm dist-tag（latest/beta/…） | `--npmTag` |
| `selectVersion` | 选择版本策略或手动版本 | `--release` |
| `selectMirror` | 选择镜像 registry（列表末项为 `all`） | `--mirrorType` |
| `commitTag` | 更新 version + git commit/tag/push | — |
| `build` | 执行 `{packager} {buildScript}` | — |
| `publish` | 推送到选定镜像或全部镜像 | 需配合 mirrorType/npmTag |

示例：

```bash
# 仅执行：选版本 + 构建 + 推送
pnpm publish:release -- --task selectVersion-build-publish

# 非交互完整发布
publisher-npm run \
  --config ./build.config.json \
  --npmTag latest \
  --release patch \
  --mirrorType XYLink

# 非交互，发布到全部镜像
publisher-npm run \
  --config ./build.config.json \
  --npmTag latest \
  --release patch \
  --mirrorType all
```

### 镜像选择说明

交互列表顺序：用户 `mirrorMap` 配置的镜像 → 内置 `NPM` → `all`（全部镜像）。`all` 不在 mirrorMap 中，不可作为 mirrorMap 的 key。`--reverse` 不支持 `all`。

### 配置文件 build.config.json

在项目根目录（或通过 `--config` 指定路径）添加：

```json
{
  "buildScript": "build",
  "packager": "pnpm",
  "mirrorMap": {
    "XYLink": "https://fe-private-npm.xylink.com/"
  },
  "projectName": "Publisher NPM",
  "commitMessage": "feat: publish release version %n@%s [#000000]",
  "buildDir": ".",
  "projectDir": ".",
  "tagName": "%n@%s"
}
```

| 字段 | 说明 |
| --- | --- |
| `buildScript` | package.json 中的构建脚本名 |
| `buildDir` | publish 时的工作目录 |
| `projectDir` | package.json 所在目录（Monorepo 子包路径） |
| `packager` | 包管理器：pnpm / yarn / npm |
| `mirrorMap` | 镜像 key → registry URL；会与内置 `NPM: https://registry.npmjs.org/` 合并 |
| `tagName` | git tag 模板，`%n` 包名，`%s` 版本 |
| `projectName` | 日志中的项目展示名 |
| `commitMessage` | git commit 模板，`%n` 包名，`%s` 版本 |

## package.json 脚本示例

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

## 使用

```bash
# 快速 Beta
pnpm publish:beta

# Release（交互式）
pnpm publish:release

# 撤销版本
pnpm reverse
```

## 发布失败与重试

工具在 **git commit、build、publish** 任一步失败时会立即中断，进程以 **exit code 1** 退出，不会误报「发布成功」。

### 常见 npm 错误

| 错误码 | 含义 | 处理建议 |
| --- | --- | --- |
| E404 | 无发布权限或包不存在 | 检查 `npm whoami`；确认包名归属；或改用私有镜像 |
| E403 | 权限不足 | 检查 org 权限、2FA、token scope |
| E401 | 未登录 | `npm login` 或配置 `.npmrc` |
| E409 | 版本已存在 | 升级版本号 |

### 版本已提交但 publish 失败

若 `commitTag` 已成功、publish 失败，`package.json` 与 git 可能已是新版本，registry 尚未收到包。可：

**方式 1 — 仅重试推送（推荐，不升版本）：**

```bash
publisher-npm run \
  --config ./build.config.json \
  --task publish \
  --mirrorType NPM \
  --npmTag latest
```

**方式 2 — 手动 publish：**

```bash
pnpm publish --tag latest --access public \
  --registry https://registry.npmjs.org/ \
  --no-git-checks
```

**方式 3 — 回滚版本后重新发布：**

```bash
git revert HEAD   # 或手动改回 package.json 版本
# 再执行完整 publish:release
```

失败时工具会自动打印上述命令与修复建议。

## 发布流水线

```
检测 git 干净 → 读取配置 → [选 Tag/版本/镜像] → 提交版本 → 构建 → 推送
```

## License

Copyright (c) 2025. Licensed under the MIT license.

## Author

Jinghui Luo — <luojinghui424@gmail.com>
