# NPM Publisher

A tool for NPM version management, mirror management, build automation, and automatic push of NPM packages for any project that needs to push a repository, such as TS/JS libraries, component libraries, Monorepo libraries, etc.

针对 TS/JS 库、组件库、Monorepo 库等任何需推送镜像仓库的项目进行 NPM 版本管理、镜像管理、构建自动化和 NPM 包的自动推送工具。

## 功能

1. 支持基于 Npm Version 标准版本管控和手动指定版本管理
2. 支持配置 Tag 格式和 Commit 内容格式，支持自动提交 Tag 和提交版本 Log
3. 支持配置推送包目录和项目根目录，可在任何独立项目或者 Monorepo 项目下使用
4. 支持快速构建 Beta 版本
5. 支持 Task 节点热插拔，可按需执行任务，例如忽略构建、忽略版本选择、忽略推送、忽略提交 Tag 等
6. 支持配置文件（build.config.json），配置多个镜像地址，支持自动切换镜像地址发布 NPM 包
7. 支持版本更新后，自动化执行构建资源，并自动推送指定镜像仓库
8. 支持任意包管理器：pnpm、yarn、npm 等等
9. 支持撤销仓库版本

## 功能演示

快速自动构建 Beta 资源：

![build_1](https://github.com/luojinghui/publisher-npm/assets/12367406/ad008627-799f-4c47-9b78-817e87ce8e50)

基于手动选择方式构建资源：

![release_2](https://github.com/luojinghui/publisher-npm/assets/12367406/ca1f6744-ec02-4314-8ccb-64594d0b72da)

## 安装

```bash
pnpm add publisher-npm -D
```

## 快速开始

```base
publisher-npm run [--config /path/build.config.json] [--configIgnore] [--quickBeta] [--reverse] [--task] [-v] [-h]
```

### 参数说明

- `--config` 可选参数，配置后在后面跟随填写配置文件路径地址，会基于此配置更新配置内容，如果未指定，则会自动读取跟路径下的`build.config.json`文件
- `--configIgnore` 可选参数，是否省略配置，如果项目中仅需支持 NPM 镜像仓库，则无需配置`build.config.json`文件，使用此参数即可
- `--quickBeta` 可选参数，配置是否快速构建 Beta 版本，默认是不构建，构建时默认使用第一个镜像仓库地址推送 NPM 包
- `--reverse` 可选参数，是否执行撤销版本操作，如果启用，则需要输入版本号和选择仓库进行撤销版本操作
- `--task` 可选参数，按需执行 Task 任务，默认是执行所有任务，配置一个字符串，使用"-"连接任务，可配置：selectVersion,selectMirror,commitTag,build,publish，例如：--task selectVersion-build-publish，仅执行选择版本+构建+推送包任务

### 添加配置文件

在项目跟目录添加配置文件：`build.config.json`

> 如果配置文件是非项目根目录，则需要使用--config 配置加载配置路径

配置参数：

- buildScript: 构建包命令
- buildDir: 构建包的基础路径，默认是项目根目录，如需推送其他目录资源，请指定
- projectDir: 项目根目录，在 Monorepo 项目下需要指定子包的目录，默认是当前项目根目录
- packager: 项目使用的包管理器，默认是 pnpm，支持 pnpm、yarn、npm 等主流包管理器
- mirrorMap: 指定多个镜像列表，需要以 Key/Value 的形式指定，默认内部会合并 NPN 镜像，并展示 Key 的选择项，在发布时，可以选择此内容
- tagName: Tag 名称，其中"%s"会在构建时自动填充版本信息，"%n"自动填充 package.json 的名称
- projectName: 项目名称，在输出日志中展示
- commitMessage: 版本生成后，会创建对应的 git commit 和 tab commit 信息，其中"%s"会在构建时自动填充版本信息，"%n"自动填充 package.json 的名称

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

## 配置

在项目的`package.json`文件中配置构建命令：

```json
{
  "scripts": {
    "publish:beta": "publisher-npm run --config ./build.config.json --quickBeta",
    "publish:release": "publisher-npm run --config ./build.config.json",
    "reverse": "publisher-npm run --reverse"
  }
}
```

## 使用

运行构建脚本：

```bash
# 快速构建beta版本
$ pnpm publish:beta
```

```bash
# 构建Release版本
$ pnpm publish:release
```

```bash
# 撤销版本
$ pnpm reverse
```

```bash
# 执行时动态添加参数
$ pnpm publish:release --task selectVersion-build-publish
```

## License

Copyright (c) 2024. Licensed under the MIT license.

## Author

Jinghui Luo - luojinghui424@gmail.com
