# Npm Publisher

JavaScript library npm version management, build automation, and publishing tool for npm packages.

针对 JavaScript 库的 npm 版本管理、构建包自动化和 npm 包的自动发布工具。

1. 支持手动版本管理和基于 Npm Version 标准的版本规则
2. 支持快速构建 Beta 版本
3. 支持自动标记 Tag 版本并推送 Tag 版本
4. 支持配置文件（build.config.js），配置多个镜像地址，支持自动切换镜像地址发布版本
5. 支持版本更新后，自动构建 Javascript 包资源，并自动推送指定镜像仓库
6. 支持任意包管理器：pnpm、yarn、npm 等等

## 安装

```bash
pnpm add publisher-npm -D
```

## 快速开始

```base
publisher-npm run [--config /path/build.config.js] [--configIgnore] [--beta] [-v] [-h]
```

参数说明:

- --config 可选参数，配置后在后面跟随填写配置文件路径地址，会基于此配置更新配置内容，如果未指定，则会自动读取跟路径下的`build.config.json`文件
- --beta 可选参数，配置是否快速构建 Beta 版本，默认是不构建，构建时默认使用第一个镜像仓库地址推送 Npm 包
- --configIgnore 可选参数，是否省略配置，如果项目中仅需支持 NPM 镜像仓库，则无需配置`build.config.json`文件，使用此参数即可

### 添加配置文件

在项目跟目录添加配置文件：`build.config.json`

> 如果是其他目录，则需要使用--config 配置加载配置路径

```json
{
  // 构建包命令，从 package.json 中的script中获取
  "buildScript": "build",
  // 项目使用的包管理器，支持pnpm、yarn、npm等
  "packager": "pnpm",
  // 指定多个镜像列表，默认内部会合并Npm镜像，在发布时，可以选择任意发布镜像地址
  "mirrorMap": {
    "Private": "https://xxx.xxx.xxx/",
    "Private2": "https://xxx.xxx.xxx/",
  },
  // 项目名称，在输出日志中展示
  "projectName": "XYLink WebRTC SDK",
  "commitMessage": "feat: Publish Release Version:",
  "commitMessageAfter": "[#000000]"
};
```

## 配置

在项目的`package.json`文件中配置构建命令：

```json
{
  "scripts": {
    "build:lib": "echo \"build  successfully\"",
    "publish:beta": "publisher-npm run --config ./build.config.json --beta",
    "publish:release": "publisher-npm run --config ./build.config.json",
    "publish:common": "publisher-npm run"
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

## License

Copyright (c) 2024. Licensed under the MIT license.

## Author

Jinghui Luo - luojinghui424@gmail.com
