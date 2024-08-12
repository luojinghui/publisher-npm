import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import semver from 'semver';

export const gitTagPush = `git push --tags`;
export const gitAdd = 'git add .';
export const gitPush = (branch) => `git push --set-upstream origin ${branch}`;
export const gitCommit = (commit) => `git commit -m "${commit}"`;
export const gitTag = (commit, version) => `git tag -a v${version} -m "${commit}"`;
export const gitStatus = 'git status --porcelain';
export const gitCurrentBranch = 'git rev-parse --abbrev-ref HEAD';

/**
 * NPM Tag枚举
 */
export const NPMTagMap = {
  beta: 'beta',
  private: 'private',
  release: 'latest',
  rc: 'rc',
  alpha: 'alpha',
};

/**
 * 默认镜像地址
 * 如需添加其他配置，请在初始化配置中填充，会自动合并当前配置
 */
export const MirrorMap = {
  NPM: 'https://registry.npmjs.org/',
};

/**
 * NPM 版本变动类型
 */
export const ReleaseMap = {
  prerelease: 'prerelease',
  patch: 'patch',
  prepatch: 'prepatch',
  minor: 'minor',
  preminor: 'preminor',
  major: 'major',
  premajor: 'premajor',
  manual: 'manual input version',
};

export const FilterReleaseMap = ['patch', 'minor', 'major', 'manual'];

export const TaskConfigMap = ['selectVersion', 'selectMirror', 'commitTag', 'build', 'publish'];

/**
 * 获取更新镜像地址配置
 *
 * @param { string } packager - 包管理器
 * @param { string } mirrorType - 镜像类型
 * @returns { string } - 设置镜像配置字符串
 */
export const getRegistry = (packager, mirrorMap, mirrorType) => {
  const mirror = mirrorMap[mirrorType];

  if (!mirror) {
    return '';
  }

  return `${packager} config set registry ${mirror}`;
};

/**
 * 获取推送版本的命令配置
 *
 * @param { string } packager - 包管理器
 * @param { string } npmTag - 发布版本的tag
 * @returns { string } - 推送版本的命令配置
 */
export const getPublishCommend = (packager, npmTag, mirror) => {
  return `${packager} publish --tag ${npmTag} --access public --registry ${mirror} --no-git-checks`;
};

/**
 * 检测当前项目git是否存在变动
 */
export async function checkUncommittedChanges() {
  try {
    const res = await execShell(gitStatus);

    if (res.length === 0) {
      return true;
    }

    return Promise.reject('Git has not commit changes');
  } catch (error) {
    Logger.error('Git has not commit changes');
    return Promise.reject('Git check error');
  }
}

/**
 * 执行Shell脚本
 */
export function execShell(command, outputLog = false) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (outputLog) {
        console.log('output: ', stdout);
        console.log('stderr: ', stderr);
      }

      if (error) {
        reject(`run commend error: ${error.message}`);
      }

      if (stderr) {
        reject(`run commend err: ${stderr}`);
      }

      resolve(stdout);
    });
  });
}

/**
 * 验证版本规则
 */
export function validateVersion(version) {
  // 正式版本规则
  const officialPattern = /^(\d+)\.(\d+)\.(\d+)$/;
  // Beta版本规则
  const betaPattern = /^(\d+)\.(\d+)\.(\d+)-[a-zA-Z]+\.(\d+)$/;

  if (officialPattern.test(version) || betaPattern.test(version)) {
    return true;
  }

  return false;
}

/**
 * 快速构建配置
 *
 * 当前支持的参数：--beta，使用方式：node build.mjs --quickBeta
 */
export const getQuickConfigMap = (mirrorMap) => {
  const keys = Object.keys(mirrorMap);
  const firstMirrorType = keys[0];

  return {
    npmTag: NPMTagMap.beta,
    release: ReleaseMap.prerelease,
    mirrorType: firstMirrorType,
  };
};

/**
 * 获取版本更新方式问题配置
 */
export const getQuestionNPMTag = (projectName) => {
  const choices = [];

  for (const key in NPMTagMap) {
    choices.push(NPMTagMap[key]);
  }

  const QuestionTag = [
    {
      type: 'list',
      name: 'npmTag',
      message: `选择发布${projectName}的Tag类型`,
      choices,
      filter: function (val) {
        return val.toLowerCase();
      },
    },
  ];

  return QuestionTag;
};

/**
 * 获取输入版本方式配置
 */
export const QuestionInputVersion = [
  {
    type: 'input',
    name: 'release',
    message: `请手动输入版本号，规则如下：\n正式版本：[MAJOR.MINOR.PATCH]\n测试版本：[MAJOR.MINOR.PATCH-[TAG].BUILD]\n`,
    validate: (version) => {
      if (validateVersion(version)) {
        return true;
      }

      return '版本号不符合规则，请重新输入\n';
    },
  },
];

/**
 * 获取更新版本的方式问题配置
 */
export const getQuestionNextVersion = (currentVersion, npmTag) => {
  const isReleaseVersion = npmTag === NPMTagMap.release;
  const prerelease = semver.inc(currentVersion, 'prerelease', npmTag);
  const patch = semver.inc(currentVersion, 'patch', npmTag);
  const prepatch = semver.inc(currentVersion, 'prepatch', npmTag);
  const minor = semver.inc(currentVersion, 'minor', npmTag);
  const preminor = semver.inc(currentVersion, 'preminor', npmTag);
  const major = semver.inc(currentVersion, 'major', npmTag);
  const premajor = semver.inc(currentVersion, 'premajor', npmTag);
  const versionMap = {
    prerelease: `prerelease->${prerelease}`,
    patch: `patch->${patch}`,
    prepatch: `prepatch->${prepatch}`,
    minor: `minor->${minor}`,
    preminor: `preminor->${preminor}`,
    major: `major->${major}`,
    premajor: `premajor->${premajor}`,
    manual: ReleaseMap.manual,
  };
  const currentVerMsg = chalk.green(`当前版本: ${currentVersion}`);
  const choices = [];
  const message = `请选择版本，${currentVerMsg}`;

  for (let key in versionMap) {
    if (isReleaseVersion && FilterReleaseMap.includes(key)) {
      choices.push(versionMap[key]);
    } else if (!isReleaseVersion) {
      choices.push(versionMap[key]);
    }
  }

  return [{ type: 'list', name: 'release', message, choices, loop: false }];
};

/**
 * 获取使用镜像方式配置
 */
export const getQuestionMirrorType = (mirrorMap) => {
  const choices = [];
  let message = '请选择镜像：';

  for (let key in mirrorMap) {
    choices.push(key);
    message += `\n${key}: ${mirrorMap[key]}`;
  }

  const QuestionMirrorType = [{ type: 'list', name: 'mirrorType', message, choices: choices }];

  return QuestionMirrorType;
};

/**
 * 获取撤销版本命令
 *
 * @param { string } packager - 包管理器
 * @param { string } version - 需要撤销的版本
 * @param { string } mirror - 选择的镜像地址
 * @return { string } - 返回撤销版本的命令
 */
export const createReverseScript = async (packager, version, mirror, packagePath) => {
  const pak = await readePackageJson(packagePath);
  const name = pak.name;
  const module = `${name}@${version}`;
  const script = `${packager} unpublish ${module} --force --registry ${mirror}`;

  return { script, module };
};

/**
 * 获取PackageJson文件内容
 */
export const readePackageJson = (path) => {
  const packageJson = fs.readFileSync(path, 'utf8');
  const packageJsonObj = JSON.parse(packageJson);

  return packageJsonObj;
};

/**
 * 获取Config文件内容
 *
 * @param { string } path - Config文件路径
 */
export const readeConfigJson = (path) => {
  const config = fs.readFileSync(path, 'utf8');
  const parseConfig = JSON.parse(config);

  return parseConfig;
};

/**
 * 更新PackageJson的版本信息
 */
export const updatePackageJsonVersion = (path, version) => {
  const packageJson = fs.readFileSync(path, 'utf8');
  const packageJsonObj = JSON.parse(packageJson);

  packageJsonObj.version = version;
  fs.writeFileSync(path, JSON.stringify(packageJsonObj, null, 2) + '\n', 'utf8');

  return true;
};

/**
 * 获取当前分支
 */
export const getCurrentBranch = () => {
  return execShell(gitCurrentBranch);
};

export class Logger {
  static log(key, value) {
    this.printMessage(chalk.dim, key, value);
  }

  static cyan(key, value) {
    this.printMessage(chalk.cyanBright, key, value);
  }

  static green(key, value) {
    const emoji = getEmoji();
    this.printMessage(chalk.green, key, value, emoji);
  }

  static error(key, value) {
    const emoji = '❌';
    this.printMessage(chalk.red, key, value, emoji);
  }

  static warn(key, value) {
    const emoji = '☹️';
    this.printMessage(chalk.cyan, key, value, emoji);
  }

  static printMessage(colorFunction, key, value, emoji = '') {
    if (value) {
      console.log(colorFunction(emoji, key, value));
    } else {
      console.log(colorFunction(emoji, key));
    }
  }
}

/**
 * 获取随机数
 */
const getRandom = (min, max) => {
  return Math.round(Math.random() * (max - min)) + min;
};

export const getEmoji = () => {
  const RANDOM_EMOJI = [
    '🎉🎉',
    '🌺🌺',
    '🍓🍓',
    '🛴🛵🏎️',
    '🍎🍎',
    '😎😎',
    '🌹🌹',
    '🐷🐷',
    '🍭🍭',
    '🇨🇳🇨🇳',
    '🐤🐤',
    '🌈🌈',
    '🐶🐶',
    '🍇🍇',
    '⚽️🏀',
    '👏👏',
    '💰💰',
    '🍀🍀',
    '🍑🍑',
    '🌸🌸',
    '💄💄',
    '🍉🍉',
    '🍔🍔',
    '🍷🍷',
    '⛱️⛱️',
    '🌷🌷',
    '🍄🍄',
    '🌴🌴',
  ];

  return RANDOM_EMOJI[getRandom(0, RANDOM_EMOJI.length - 1)];
};
