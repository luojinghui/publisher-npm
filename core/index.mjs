/**
 * XYLink WebRTC SDK Build Tools
 *
 * @authors Luo-jinghui (luojinghui424@gmail.com)
 *
 * Created at     : 2022-08-12 19:11:52
 * Last modified  : 2024-08-13 10:37:27
 */

import inquirer from 'inquirer';
import {
  checkUncommittedChanges,
  QuestionInputVersion,
  getQuestionNextVersion,
  getQuestionMirrorType,
  getQuestionNPMTag,
  readePackageJson,
  updatePackageJsonVersion,
  execShell,
  gitAddCommand,
  gitCommit,
  gitPush,
  getCurrentBranch,
  NPMTagMap,
  gitTag,
  gitTagPushCommand,
  MirrorMap,
  getQuickConfigMap,
  getPublishCommend,
  Logger,
  readeConfigJson,
  createReverseScript,
  ReleaseMap,
  TaskConfigMap,
} from './tool.mjs';
import path from 'path';

class Publisher {
  constructor() {
    this.currentVersion = '';

    /**
     * 用户在命令行执行的结果配置
     */
    this.userSelectConfig = {
      npmTag: NPMTagMap.beta,
      release: ReleaseMap.prerelease,
      mirrorType: Object.keys(MirrorMap)[0],
    };

    /**
     * 命令行配置
     */
    this.commandConfig = {
      config: 'build.config.json',
      configIgnore: false,
      quickBeta: false,
      reverse: false,
      task: 'selectVersion-selectMirror-commitTag-build-publish',
      taskConfig: {
        selectVersion: false,
        selectMirror: false,
        commitTag: false,
        build: false,
        publish: false,
      },
    };

    /**
     * 用户BuildConfig配置文件内容
     */
    this.buildConfig = {
      // 构建Script脚本命令
      buildScript: '',
      // 构建包的基础路径，默认是项目根目录，如需推送其他目录资源，请指定
      buildDir: '.',
      // 项目根目录，在Monorepo项目下需要指定子包的目录，默认是当前项目根目录
      projectDir: '.',
      // 包管理器，默认是pnpm
      packager: 'pnpm',
      // 镜像配置列表，key是镜像名，value是镜像地址，配置后将在命令行发布镜像选择中罗列出来
      // 格式：{ XYLink: 'https://fe-private-npm.xylink.com/' }
      // 镜像管理器，支持扩展镜像地址，会合并默认的NPM镜像地址
      mirrorMap: MirrorMap,
      // 项目名称，构建资源包时提醒
      projectName: 'Default Project',
      // 版本生成后，会创建对应的git commit和tab commit信息，其中"%s"是自动填充版本信息
      commitMessage: 'feat: publish release version v%s [#000000]',
    };
  }

  /**
   * 交互获取推送信息
   */
  async run(options) {
    try {
      Logger.log('正在检测文件变动...');
      await checkUncommittedChanges();

      await this.parseCommandConfig(options);

      const { quickBeta, reverse } = this.commandConfig;

      // 快速构建
      if (quickBeta && !reverse) {
        this.userSelectConfig = getQuickConfigMap(this.buildConfig.mirrorMap);
        Logger.log('开始快速Beta版本构建...');
      }

      // 撤销版本
      if (reverse) {
        Logger.green('开始启动撤销版本流程');
        await this.reverseVersion();
      }

      if (!reverse) {
        // 创建构建配置
        Logger.green('检测完成，开始准备发布版本');

        await this.createBuildConfig();
        await this.createVersion();
        await this.buildPackage();
        await this.publishPackage();
      }
    } catch (error) {
      if (this.reverse) {
        Logger.error('unpublish error', error);
        return Promise.reject(error);
      } else {
        Logger.error('publish error', error);
        return Promise.reject(error);
      }
    }
  }

  /**
   * 解析配置文件中的内容，同步给构建模块
   */
  async parseCommandConfig(options) {
    this.commandConfig = { ...this.commandConfig, ...options };
    const { config, configIgnore } = this.commandConfig;
    let configFileContent = {};

    const hasError = this.parseTask();

    if (hasError) {
      Logger.error('--task params error, please check, support: selectVersion,selectMirror,commitTag,build,publish');
      return Promise.reject('--task params error, please check');
    }

    if (config && !configIgnore) {
      const parsePath = path.resolve(process.cwd(), config);

      try {
        configFileContent = await readeConfigJson(parsePath);
      } catch (error) {
        Logger.error(`配置文件:${parsePath} 不存在，请检查配置文件和路径，如需使用默认参数，请添加--configIgnore参数`);
        return Promise.reject('Config file not found');
      }
    }

    this.buildConfig = { ...this.buildConfig, ...configFileContent };
    this.buildConfig.mirrorMap = { ...this.buildConfig.mirrorMap, ...MirrorMap };
    const packagePath = this.getPackageJsonPath();
    this.currentVersion = readePackageJson(packagePath).version;
  }

  /**
   * 获取项目packageJson文件的路径
   *
   * @returns { string } - package.json文件路径
   */
  getPackageJsonPath() {
    const { projectDir } = this.buildConfig;
    const packagePath = path.resolve(process.cwd(), projectDir, 'package.json');

    return packagePath;
  }

  parseTask() {
    const { task } = this.commandConfig;
    const parseTask = task.split('-');
    let hasError = false;

    parseTask.forEach((key) => {
      const is = TaskConfigMap.includes(key);

      if (is) {
        this.commandConfig.taskConfig[key] = true;
      } else {
        hasError = true;
      }
    });

    return hasError;
  }

  /**
   * 撤销版本
   */
  async reverseVersion() {
    const { mirrorMap, packager } = this.buildConfig;

    const { release } = await inquirer.prompt(QuestionInputVersion);
    const { mirrorType } = await inquirer.prompt(getQuestionMirrorType(mirrorMap));
    const mirror = mirrorMap[mirrorType];
    const packagePath = this.getPackageJsonPath();
    const { script, module } = await createReverseScript(packager, release, mirror, packagePath);

    Logger.log('unpublish script: ', script);
    try {
      await execShell(script, true);
    } catch (error) {}

    Logger.green('撤销版本成功：', module);
  }

  /**
   * 创建构建配置
   */
  async createBuildConfig() {
    const { quickBeta } = this.commandConfig;

    if (quickBeta) {
      return;
    }

    try {
      const { selectVersion, selectMirror } = this.commandConfig.taskConfig;

      if (selectVersion) {
        await this.createNpmVersion();
      }

      if (selectMirror) {
        await this.createMirrorType();
      }

      Logger.log('发布版本配置信息', JSON.stringify(this.userSelectConfig));
    } catch (error) {
      Logger.error('版本发布失败，请检查', error);
      return Promise.reject('Version publish failed');
    }
  }

  async createNpmVersion() {
    // 获取发布库的TAG类型
    const { npmTag } = await inquirer.prompt(getQuestionNPMTag(this.buildConfig.projectName));
    this.userSelectConfig.npmTag = npmTag;
    // 通过 NPM 包版本类型
    const { release } = await inquirer.prompt(getQuestionNextVersion(this.currentVersion, npmTag));
    const isInputVersion = release === ReleaseMap.manual;

    if (isInputVersion) {
      const { release } = await inquirer.prompt(QuestionInputVersion);

      this.userSelectConfig.release = release;
    } else {
      const parseRelease = release.split('->')[0];
      this.userSelectConfig.release = parseRelease;
    }
  }

  async createMirrorType() {
    // 选择镜像地址
    const { mirrorType } = await inquirer.prompt(getQuestionMirrorType(this.buildConfig.mirrorMap));
    this.userSelectConfig.mirrorType = mirrorType;
  }

  /**
   * 创建Npm Version
   */
  async createVersion() {
    const { commitTag } = this.commandConfig.taskConfig;

    if (!commitTag) {
      Logger.log('忽略提交Tag版本！');
      return;
    }

    Logger.log('开始更新Npm Version...');
    const { release } = this.userSelectConfig;
    const isNpmVersion = !!ReleaseMap[release];
    const { commitMessage } = this.buildConfig;
    const replaceCommitMessage = commitMessage.replace('%s', release);
    const branch = await getCurrentBranch();
    const gitCommitCommand = gitCommit(replaceCommitMessage);
    const gitPushCommand = gitPush(branch.trim());
    const gitCommitPushCommand = `${gitAddCommand} && ${gitCommitCommand} && ${gitPushCommand}`;

    try {
      // 手动输入版本，更新packageJson文件，并提交代码
      if (!isNpmVersion) {
        const packageJsonPath = this.getPackageJsonPath();
        updatePackageJsonVersion(packageJsonPath, release);
        const gitAddTagCommand = gitTag(replaceCommitMessage, release);

        try {
          await execShell(gitCommitPushCommand, true);
          Logger.green('手动版本变动Git提交成功');
        } catch (error) {}

        try {
          await execShell(gitAddTagCommand);
          await execShell(gitTagPushCommand);
        } catch (error) {}
        Logger.green('Git变更SDK Version提交成功: ', release);
      } else {
        // Npm Version更新版本
        const { npmTag, release } = this.userSelectConfig;
        const { commitMessage } = this.buildConfig;
        const { projectDir } = this.buildConfig;
        const projectPath = path.resolve(process.cwd(), projectDir);
        const pwdPath = path.resolve(process.cwd());
        const npmVersion = `npm version ${release} --preid=${npmTag} -m "${commitMessage}"`;

        await execShell(`cd ${projectPath} && pwd && ${npmVersion}`);

        try {
          await execShell(gitCommitPushCommand, true);
          await execShell(gitTagPushCommand);
        } catch (error) {}

        const packagePath = this.getPackageJsonPath();
        const version = readePackageJson(packagePath).version;
        Logger.green('Npm变更SDK Version提交成功: ', version);
      }
    } catch (error) {
      Logger.error('Npm 版本生成失败，请检查', error);

      return Promise.reject('npm version error');
    }
  }

  /**
   * 构建资源
   */
  async buildPackage() {
    const { build } = this.commandConfig.taskConfig;

    if (!build) {
      Logger.log('忽略构建版本！');
      return;
    }

    let script = '';

    try {
      Logger.log('开始构建SDK包...');
      const { packager, buildScript } = this.buildConfig;

      if (!buildScript) {
        Logger.log('构建命令 buildScript 配置为空，跳过构建包步骤');
        return;
      }

      const buildCommend = `${packager} ${buildScript}`;
      script = buildCommend;
      await execShell(buildCommend, true);

      Logger.green('构建SDK包成功');
    } catch (error) {
      Logger.error('build script:', script);
      Logger.error('build package error', error);
      return Promise.reject('build package error');
    }
  }

  /**
   * 推送Npm Package
   */
  async publishPackage() {
    const { publish } = this.commandConfig.taskConfig;

    if (!publish) {
      Logger.log('忽略发布版本！');
      return;
    }

    const packagePath = this.getPackageJsonPath();
    const { name, version } = readePackageJson(packagePath);
    const { npmTag, mirrorType } = this.userSelectConfig;
    const { projectName, mirrorMap, packager, buildDir } = this.buildConfig;
    const packageDir = path.resolve(buildDir);

    Logger.log(`开始推送${projectName} Npm包...`);
    Logger.log('build package directory: ', packageDir);

    try {
      const mirror = mirrorMap[mirrorType];
      const cd = `cd ${packageDir}`;
      const publishCommend = getPublishCommend(packager, npmTag, mirror);

      Logger.log('publish package: ', publishCommend);
      Logger.log('正在推送SDK包...');

      try {
        await execShell(`${cd} && pwd && ${publishCommend}`, true);
      } catch (error) {}

      Logger.green(`已推送包到${mirrorType}仓库：`, `${name}@${version}`);
    } catch (error) {
      Logger.error('publish package error:', error);
    }
  }
}

const publisher = new Publisher();

export { publisher };
