/**
 * XYLink WebRTC SDK Build Tools
 *
 * @authors Luo-jinghui (luojinghui424@gmail.com)
 *
 * Created at     : 2022-08-12 19:11:52
 * Last modified  : 2024-07-04 16:59:02
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
} from './tool.js';
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
  }

  /**
   * 解析配置文件中的内容，同步给构建模块
   */
  async parseCommandConfig(options) {
    let quicklyConfig = {};
    const { config } = options;
    const configPath = path.resolve(process.cwd(), config);

    try {
      const module = await import(configPath);
      quicklyConfig = module.default;
    } catch (error) {
      quicklyConfig = {};
    }

    /**
     * 构建资源Script命令：通过packager+buildScript组合运行，例如：'pnpm build'
     * 格式：string
     */
    this.buildScript = quicklyConfig.buildScript || 'build';
    /**
     * 配置包管理器，支持 pnpm | yarn | npm 等主流管理器
     * 格式：string
     */
    this.packager = quicklyConfig.packager || 'pnpm';
    /**
     * 镜像管理器，支持扩展镜像地址，会合并默认的NPM镜像地址
     * 格式：{ XYLink: 'https://fe-private-npm.xylink.com/' }
     */
    this.mirrorMap = quicklyConfig.mirrorMap ? { ...quicklyConfig.mirrorMap, ...MirrorMap } : MirrorMap;
    /**
     * 项目名称
     * 格式：string
     */
    this.projectName = quicklyConfig.projectName || 'Project';
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
    const { config = '', beta = false } = options;

    await this.parseCommandConfig(options);

    try {
      // 快速构建
      if (beta) {
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

      Logger.log('发布版本配置信息', this.config);
    } catch (error) {
      Logger.error('版本发布失败，请检查', error);
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
        const gitCommend = `${gitAdd} && ${gitCommit(version)} && ${gitPush(branch.trim())}`;
        
        console.log('gitCommend: ', gitCommend);

        try {
          await execShell(gitCommend);
        } catch (error) {
          Logger.error('version push error', error);
        }

        try {
          await execShell(gitTag(version));
          await execShell(gitTagPush);
        } catch (error) {}

        Logger.green('Git变更SDK Version提交成功: ', version);
      } else {
        // Npm Version更新版本
        const tag = TagMap[npmTag];
        const npmVersion = `npm version ${updateVersionType} --preid=${tag} -m "feat: Publish Release Version: %s [#000000]"`;

        await execShell(npmVersion);

        try {
          await execShell(gitTagPush);
        } catch (error) {}

        const version = readePackageJson().version;
        Logger.green('Npm变更SDK Version提交成功: ', version);
      }
    } catch (error) {
      Logger.error('create version error', error);

      return Promise.reject('npm version error, 请检查');
    }
  }

  /**
   * 构建资源
   */
  async buildPackage() {
    try {
      Logger.log('开始构建SDK包...');

      const buildCommend = `${this.packager} ${this.buildScript}`;
      await execShell(buildCommend, true);

      Logger.green('构建SDK包成功');
    } catch (error) {
      Logger.error('build package error', error);
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
      const registry = getRegistry(this.packager, this.mirrorMap, mirrorType);
      const mirror = this.mirrorMap[mirrorType];

      if (!registry) {
        Logger.error('镜像地址错误，停止推送', mirror);
        return;
      }

      await execShell(registry);
      Logger.green('切换Npm镜像成功: ', mirror);

      const publishCommend = getPublishCommend(this.packager, npmTag);

      try {
        await execShell(publishCommend, true);
      } catch (error) {}

      Logger.green(`已推送包到${mirrorType}仓库：`, `${name}@${version}`);
    } catch (error) {
      Logger.error('publish package error:', error);
    }
  }
}

const publisher = new Publisher();

export { publisher };
