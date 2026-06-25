# AGENTS.md — publisher-npm 机器可读参考

> 本文档面向 AI Agent / CI 脚本，描述工具的**确定性行为契约**。人类用户请同时阅读 [README.md](./README.md)。

## 工具标识

| 字段 | 值 |
| --- | --- |
| 包名 | `publisher-npm` |
| CLI 入口 | `publisher-npm run` 或 `node index.mjs run` |
| 语言 | Node.js ESM (`.mjs`) |
| 核心模块 | `core/index.mjs`（编排）、`core/tool.mjs`（Shell/解析） |
| 默认配置文件 | 项目根目录 `build.config.json`（可通过 `--config` 指定） |

## 发布流水线（默认顺序）

```
checkUncommittedChanges
  → parseCommandConfig
  → createBuildConfig      [tasks: selectTag, selectVersion, selectMirror]
  → createVersion          [task: commitTag]
  → buildPackage           [task: build]
  → publishPackage         [task: publish]
```

- 任一步骤失败 → **立即中断（fail-fast）**，进程 **exit code 1**
- 成功完成全部步骤 → **exit code 0**
- `--reverse` 时走独立 `reverseVersion` 流程，不执行上述发布流水线

## CLI 命令

```bash
publisher-npm run [options]
node index.mjs run [options]
```

### 全部参数

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `--config <path>` | string | `build.config.json` | 构建配置文件路径（相对 cwd） |
| `--configIgnore` | flag | false | 忽略配置文件，使用内置默认 |
| `--quickBeta` | flag | false | 跳过交互，自动 beta 预发布（prerelease + beta tag + mirrorMap 第一项） |
| `--reverse` | flag | false | 撤销（unpublish）指定版本 |
| `--notPush` | flag | false | 版本变更仅本地 commit，不 git push |
| `--task <tasks>` | string | 见下表 | 用 `-` 连接要执行的任务节点 |
| `--mirrorType <name>` | string | — | 跳过镜像选择；必须是 mirrorMap 中的 key |
| `--npmTag <tag>` | string | — | 跳过 Tag 选择，如 `latest`、`beta` |
| `--release <value>` | string | — | 跳过版本选择；见 Release 取值表 |
| `-v, --version` | flag | — | 打印 CLI 版本 |

### 默认 --task 值

```
selectTag-selectVersion-selectMirror-commitTag-build-publish
```

### Task 节点

| Task | 交互 | CLI 替代参数 | 行为 |
| --- | --- | --- | --- |
| `selectTag` | 选择 npm dist-tag | `--npmTag` | 设置 `userSelectConfig.npmTag` |
| `selectVersion` | 选择 semver 策略 | `--release` | 设置 `userSelectConfig.release` |
| `selectMirror` | 选择镜像 key | `--mirrorType` | 设置 `userSelectConfig.mirrorType` |
| `commitTag` | 无 | — | 更新 package.json version + git commit/tag/push |
| `build` | 无 | — | 执行 `{packager} {buildScript}` |
| `publish` | 无 | 需已设定 mirrorType/npmTag | 向单个镜像 publish |

**Task 组合规则：**

- 省略的 task 不会执行对应步骤
- `--task publish` 仅推送，不升版本、不构建（需 `--mirrorType` + `--npmTag` 避免交互）
- CLI 参数优先级 **高于** inquirer 交互

### Release 取值（--release）

| 值 | 含义 |
| --- | --- |
| `patch` / `minor` / `major` | semver.inc 对应策略 |
| `prerelease` / `prepatch` / `preminor` / `premajor` | 预发布策略 |
| `current` | 保持 package.json 当前版本 |
| `1.2.3` 等 | 手动指定版本号（须符合 validateVersion 规则） |

## build.config.json Schema

```json
{
  "buildScript": "string — package.json scripts 中的脚本名，如 build",
  "buildDir": "string — publish 时 cd 的目录，默认 .",
  "projectDir": "string — package.json 所在目录，Monorepo 子包路径",
  "packager": "string — pnpm | yarn | npm，默认 pnpm",
  "mirrorMap": {
    "<MirrorKey>": "string — registry URL，须以 / 结尾"
  },
  "tagName": "string — git tag 模板，%n=包名 %s=版本",
  "projectName": "string — 日志展示名",
  "commitMessage": "string — git commit 模板，%n=包名 %s=版本"
}
```

**镜像合并规则：** 运行时 `mirrorMap = { ...config.mirrorMap, ...内置 MirrorMap }`，内置始终包含：

```json
{ "NPM": "https://registry.npmjs.org/" }
```

## 非交互发布示例（供 Agent 直接调用）

```bash
# 完整 Release（CI 需预先 git clean）
publisher-npm run \
  --config ./build.config.json \
  --npmTag latest \
  --release patch \
  --mirrorType XYLink

# 仅重试 publish（版本已在 package.json / git 中）
publisher-npm run \
  --config ./build.config.json \
  --task publish \
  --mirrorType NPM \
  --npmTag latest

# 快速 Beta
publisher-npm run --config ./build.config.json --quickBeta

# 撤销版本（仍需交互输入版本号，mirror 可用 --mirrorType）
publisher-npm run --config ./build.config.json --reverse --mirrorType NPM
```

## 错误处理契约

### Shell 执行（execShell）

- **仅以 exitCode !== 0 判定失败**
- npm/pnpm 的 warn、notice 输出到 stderr **不算失败**
- 失败抛出 `ExecShellError`：`{ command, exitCode, stdout, stderr }`

### 发布失败（publishPackage / publishToMirror）

失败时工具会：

1. 打印 ❌ 及 `parseNpmPublishError` 解析结果
2. 输出修复建议列表
3. 输出手动 `{packager} publish ...` 重试命令
4. 输出 `--task publish --mirrorType ... --npmTag ...` 工具重试命令
5. 若本次运行已执行 `commitTag`（`versionCommitted=true`），额外提示版本已提交但 publish 失败

**不会**在 publish 失败时打印「已推送包到 xxx 仓库」。

### npm 错误码映射

| code | 典型原因 | Agent 建议动作 |
| --- | --- | --- |
| `E404` | 未登录 / 包名无权限 / 包不存在 | 检查 `npm whoami`；换私有镜像；改用 scoped 包名 |
| `E403` | 无 publish 权限 / 2FA 限制 | 检查 org 权限与 token scope |
| `E401` | 未认证 | `npm login` 或配置 `.npmrc` token |
| `E409` | 版本已存在 | 升版本或 unpublish（谨慎） |
| `UNKNOWN` | 其他 | 查看 `~/.npm/_logs/` |

### 其他 fail-fast 点

| 阶段 | 失败条件 |
| --- | --- |
| 启动 | git 工作区有未提交变更 |
| commitTag | git add/commit/push/tag 任一失败 |
| build | buildScript 命令非零退出 |
| reverse | unpublish 命令非零退出 |
| 配置 | `--mirrorType` 不在 mirrorMap 中 |

## 部分成功状态（重要）

当 `commitTag` 成功但 `publish` 失败时：

- `package.json` 版本 **已更新**
- git commit / tag **可能已推送**
- registry **未** 收到新版本

Agent 恢复策略（按优先级）：

1. 修复权限/registry 后 `--task publish --mirrorType <key> --npmTag <tag>` 重试（**不升版本**）
2. 若不应保留该版本：`git revert` 回滚后重新走完整流程
3. 若仅需私有源：换 `--mirrorType` 重试 publish

## 源码入口索引

| 符号 | 文件 | 说明 |
| --- | --- | --- |
| `publisher.run()` | `core/index.mjs` | 主编排 |
| `publishToMirror()` | `core/index.mjs` | 单镜像 publish（多镜像扩展点） |
| `execShell()` | `core/tool.mjs` | Shell 执行 |
| `parseNpmPublishError()` | `core/tool.mjs` | npm 错误解析 |
| `printPublishFailure()` | `core/tool.mjs` | 失败诊断输出 |
| `getPublishCommend()` | `core/tool.mjs` | 生成 publish 命令字符串 |
| `TaskConfigMap` | `core/tool.mjs` | 合法 task 名称列表 |

## 多镜像（尚未实现）

当前版本 **每次仅推送一个镜像**（`userSelectConfig.mirrorType`）。

后续扩展方向：循环调用 `publishToMirror()`，聚合 `{ mirrorType, success, error }[]` 报告；版本 bump / git 仍只做一次。

## 前置条件（Agent 执行前检查）

- [ ] git 工作区干净（无 uncommitted changes）
- [ ] 已配置 `build.config.json` 或使用 `--configIgnore`
- [ ] 目标 registry 已登录（`npm whoami` / `.npmrc`）
- [ ] 非交互场景已传 `--mirrorType`、`--npmTag`、`--release`（或 `--quickBeta`）
- [ ] `--task publish` 重试时 **不要** 包含 `commitTag`，避免重复升版本
