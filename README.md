# NPM Publisher

JavaScript library NPM version management, build automation, and publishing tool for npm packages.

针对 TS/JS 库、组件库、任何需推送 NPM 仓库的项目进行 NPM 版本管理、镜像管理、构建自动化和 NPM 包的自动推送工具。

## 功能

1. 支持基于 Npm Version 标准版本管控和手动版本管理
2. 支持自动标记版本 Tag 版本并推送 Tag 版本，支持配置提交 Commit 内容
3. 支持快速构建 Beta 版本
4. 支持配置文件（build.config.json），配置多个镜像地址，支持自动切换镜像地址发布 NPM 包
5. 支持版本更新后，自动化执行构建资源，并自动推送指定镜像仓库
6. 支持任意包管理器：pnpm、yarn、npm 等等
7. 支持撤销版本

## 功能演示

快速自动构建 Beta 资源：

![build_1](https://github.com/luojinghui/publisher-npm/assets/12367406/ad008627-799f-4c47-9b78-817e87ce8e50)

基于手动选择方式构建资源：

![relase_2](https://github.com/luojinghui/publisher-npm/assets/12367406/ca1f6744-ec02-4314-8ccb-64594d0b72da)

手动输入版本构建资源：

![release_mau_1](https://github.com/luojinghui/publisher-npm/assets/12367406/f5742353-a9b1-4ea2-8fa4-f13f63d8eb14)

## 安装

```bash
pnpm add publisher-npm -D
```

## 快速开始

```base
publisher-npm run [--config /path/build.config.json] [--configIgnore] [--quickBeta] [--reverse] [-v] [-h]
```

### 参数说明

- `--config` 可选参数，配置后在后面跟随填写配置文件路径地址，会基于此配置更新配置内容，如果未指定，则会自动读取跟路径下的`build.config.json`文件
- `--configIgnore` 可选参数，是否省略配置，如果项目中仅需支持 NPM 镜像仓库，则无需配置`build.config.json`文件，使用此参数即可
- `--quickBeta` 可选参数，配置是否快速构建 Beta 版本，默认是不构建，构建时默认使用第一个镜像仓库地址推送 NPM 包
- `--reverse` 可选参数，是否执行撤销版本操作，如果启用，则需要输入版本号和选择仓库进行撤销版本操作

### 添加配置文件

在项目跟目录添加配置文件：`build.config.json`

> 如果配置文件是非项目根目录，则需要使用--config 配置加载配置路径

配置参数：

- buildScript: 构建包命令
- packager: 项目使用的包管理器，支持 pnpm、yarn、npm 等主流包管理器
- mirrorMap: 指定多个镜像列表，需要以 Key/Value 的形式指定，默认内部会合并 NPN 镜像，并展示 Key 的选择项，在发布时，可以选择此内容
- projectName: 项目名称，在输出日志中展示
- commitMessage: 发布版本时，提交 Commit 信息，默认是`feat: Publish Release Version:` + commitMessageAfter 内容
- commitMessageAfter: 发布版本时，提交 Commit 信息的结尾内容，默认是`[#000000]`

```json
{
  "buildScript": "build",
  "packager": "pnpm",
  "mirrorMap": {
    "Private": "https://xxx.xxx.xxx/",
    "Private2": "https://xxx.xxx.xxx/"
  },
  "projectName": "WebRTC SDK",
  "commitMessage": "feat: Publish Release Version:",
  "commitMessageAfter": "[#000000]"
}
```

## 配置

在项目的`package.json`文件中配置构建命令：

```json
{
  "scripts": {
    "build:lib": "echo \"build  successfully\"",
    "publish:beta": "publisher-npm run --config ./build.config.json --beta",
    "publish:release": "publisher-npm run --config ./build.config.json",
    "publish:common": "publisher-npm run",
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
# 构建简洁配置版本
$ pnpm publish:release
```

```bash
# 撤销版本
$ pnpm reverse
```

```bash
# 执行时动态添加参数
$ pnpm publish:release --beta
```

## License

Copyright (c) 2024. Licensed under the MIT license.

## Author

Jinghui Luo - luojinghui424@gmail.com
