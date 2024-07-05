/**
 * XYLink WebRTC SDK Build Tools
 *
 * @authors Luo-jinghui (luojinghui424@gmail.com)
 *
 * Created at     : 2022-08-12 19:11:52
 * Last modified  : 2024-07-05 16:22:04
 */

import inquirer from 'inquirer';
import {
  checkUncommittedChanges,
  QuestionInputVersion,
  QuestionSwitchVersion,
  getQuestionMirrorType,
  getQuestionTag,
  readePackageJson,
  updatePackageJsonVersion,
  execShell,
  gitAdd,
  gitCommit,
  gitPush,
  getCurrentBranch,
  ChangeVType,
  TagMap,
  gitTag,
  gitTagPush,
  MirrorMap,
  getQuickConfigMap,
  getRegistry,
  getPublishCommend,
  Logger,
  readeConfigJson,
} from './tool.mjs';
import path from 'path';

class Publisher {
  constructor() {
    this.config = {
      npmTag: '',
      changeVersionType: ChangeVType.auto,
      version: '',
      updateVersionType: '',
      mirrorType: '',
    };
    this.isQuickBuild = false;
    this.configName = 'build.config.json';
  }

  /**
   * 解析配置文件中的内容，同步给构建模块
   */
  async parseCommandConfig(options) {
    const { config, configIgnore = false } = options;
    let quicklyConfig = {};
    let configPath = config;

    if (configIgnore) {
      quicklyConfig = {};
    } else if (!config) {
      configPath = this.configName;
    }

    if (configPath) {
      const parsePath = path.resolve(process.cwd(), configPath);

      try {
        quicklyConfig = await readeConfigJson(parsePath);
      } catch (error) {
        Logger.error(`配置文件:${parsePath} 不存在，请检查配置文件和路径，如需使用默认参数，请添加--configIgnore参数`);
        return Promise.reject('Config file not found');
      }
    }

    /**
     * 构建资源Script命令：通过packager+buildScript组合运行，例如：'pnpm build'
     */
    this.buildScript = quicklyConfig.buildScript || 'build';
    /**
     * 配置包管理器，支持 pnpm | yarn | npm 等主流管理器
     */
    this.packager = quicklyConfig.packager || 'pnpm';
    /**
     * 镜像管理器，支持扩展镜像地址，会合并默认的NPM镜像地址
     * 格式：{ XYLink: 'https://fe-private-npm.xylink.com/' }
     */
    this.mirrorMap = quicklyConfig.mirrorMap ? { ...quicklyConfig.mirrorMap, ...MirrorMap } : MirrorMap;
    /**
     * 项目名称，构建资源包时提醒
     */
    this.projectName = quicklyConfig.projectName || 'Project';
    this.commitMessage = quicklyConfig.commitMessage || 'feat: Publish Release Version:';
    this.commitMessageAfter = quicklyConfig.commitMessageAfter || '[#000000]';
  }

  /**
   * 快速设置配置项
   */
  setQuickConfig(config) {
    this.config = config;
    this.isQuickBuild = true;
  }

  /**
   * 交互获取推送信息
   */
  async run(options) {
    try {
      await this.parseCommandConfig(options);

      // 快速构建
      if (options.beta) {
        const config = getQuickConfigMap(this.mirrorMap, TagMap.beta);
        this.setQuickConfig(config);
      }

      Logger.green('当前SDK版本：', readePackageJson().version);
      Logger.log('正在检测文件变动...');

      await checkUncommittedChanges();

      Logger.green('检测完成，开始准备发布版本');

      if (!this.isQuickBuild) {
        await this.createBuildConfig();
      } else {
        Logger.log('开始快速Beta版本构建...');
      }

      await this.createVersion();
      await this.buildPackage();
      await this.publishPackage();
    } catch (error) {
      Logger.error('publish error', error);
    }
  }

  /**
   * 创建构建配置
   */
  async createBuildConfig() {
    try {
      const { npmTag, changeVersionType } = await inquirer.prompt(getQuestionTag(this.projectName));
      this.config.npmTag = npmTag;
      this.config.changeVersionType = changeVersionType;

      // 变更版本，开始手动输入版本
      if (changeVersionType === ChangeVType.manual) {
        const { version } = await inquirer.prompt(QuestionInputVersion);
        this.config.version = version;
      } else {
        // 通过npm version管理版本
        const { updateVersionType } = await inquirer.prompt(QuestionSwitchVersion(npmTag));
        this.config.updateVersionType = updateVersionType;
      }

      const { mirrorType } = await inquirer.prompt(getQuestionMirrorType(this.mirrorMap));
      this.config.mirrorType = mirrorType;

      Logger.log('发布版本配置信息', JSON.stringify(this.config));
    } catch (error) {
      Logger.error('版本发布失败，请检查', error);
      return Promise.reject('Version publish failed');
    }
  }

  /**
   * 创建Npm Version
   */
  async createVersion() {
    Logger.log('开始更新Npm Version...');
    const { npmTag, changeVersionType, version, updateVersionType } = this.config;

    try {
      // 手动输入版本，更新packageJson文件，并提交代码
      if (changeVersionType === ChangeVType.manual && version) {
        updatePackageJsonVersion(version);

        const branch = await getCurrentBranch();
        const commit = gitCommit(version, this.commitMessage, this.commitMessageAfter);
        const gitCommend = `${gitAdd} && ${commit} && ${gitPush(branch.trim())}`;

        try {
          await execShell(gitCommend, true);
        } catch (error) {}

        Logger.green('手动版本变动Git提交成功');

        try {
          await execShell(gitTag(version, this.commitMessage, this.commitMessageAfter));
          await execShell(gitTagPush);
        } catch (error) {}

        Logger.green('Git变更SDK Version提交成功: ', version);
      } else {
        // Npm Version更新版本
        const tag = TagMap[npmTag];
        const npmVersion = `npm version ${updateVersionType} --preid=${tag} -m "${this.commitMessage} %s ${this.commitMessageAfter}"`;

        await execShell(npmVersion);

        try {
          await execShell(gitTagPush);
        } catch (error) {}

        const version = readePackageJson().version;
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
    let script = '';

    try {
      Logger.log('开始构建SDK包...');

      const buildCommend = `${this.packager} ${this.buildScript}`;
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
    const { name, version } = readePackageJson();
    const { mirrorType, npmTag } = this.config;

    Logger.log(`开始推送${this.projectName} Npm包...`);

    try {
      // 切换镜像
      // const registry = getRegistry(this.packager, this.mirrorMap, mirrorType);
      const npmRegistry = getRegistry('npm', this.mirrorMap, mirrorType);
      const mirror = this.mirrorMap[mirrorType];

      // if (!registry) {
      //   Logger.error('镜像地址错误，停止推送', mirror);
      //   return;
      // }

      Logger.log('switch registry: ', npmRegistry);

      // await execShell(registry);
      await execShell(npmRegistry);
      Logger.green('切换Npm镜像成功: ', mirror);

      Logger.log('正在推送SDK包...');

      setTimeout(async () => {
        const address = await execShell('npm config get registry');

        console.log('=======address: ', address);

        return;

        // await execShell(`${this.packager} config list`, true);
        await execShell(`npm config list`, true);

        const publishCommend = getPublishCommend('npm', npmTag);

        Logger.log('publish package: ', publishCommend);

        try {
          await execShell(publishCommend, true);
        } catch (error) {
          Logger.warn('publish warn', error);
        }

        Logger.green(`已推送包到${mirrorType}仓库：`, `${name}@${version}`);
      }, 2000);
    } catch (error) {
      Logger.error('publish package error:', error);
    }
  }
}

const publisher = new Publisher();

export { publisher };
