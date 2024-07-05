import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

export const gitTagPush = `git push --tags`;
export const gitAdd = 'git add .';
export const gitPush = (branch) => `git push --set-upstream origin ${branch}`;
export const gitCommit = (version, commit, commitAfter) => `git commit -m "${commit} ${version} ${commitAfter}"`;
export const gitTag = (version, commit, commitAfter) =>
  `git tag -a v${version} -m "${commit} ${version} ${commitAfter}"`;
export const gitStatus = 'git status --porcelain';
export const gitCurrentBranch = 'git rev-parse --abbrev-ref HEAD';

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
export const getPublishCommend = (packager, npmTag) => {
  const tag = TagMap[npmTag];

  return `${packager} publish --tag ${tag} --access public --no-git-checks`;
};

/**
 * 版本更新方式枚举
 */
export const ChangeVType = {
  auto: 'auto',
  manual: 'manual',
};

/**
 * Tag枚举
 */
export const TagMap = {
  beta: 'beta',
  private: 'private',
  release: 'latest',
};

/**
 * 默认镜像地址
 * 如需添加其他配置，请在初始化配置中填充，会自动合并当前配置
 */
export const MirrorMap = {
  Npm: 'https://registry.npmjs.org/',
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
      }

      if (error) {
        reject(`run commend error: ${error.message}`);
        return;
      }
      if (stderr) {
        reject(`run commend err: ${stderr}`);
        return;
      }

      return resolve(stdout);
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
  const betaPattern = /^(\d+)\.(\d+)\.(\d+)-beta\.(\d+)$/;
  // 私有版本规则
  const privatePattern = /^(\d+)\.(\d+)\.(\d+)-private\.(\d+)$/;

  if (officialPattern.test(version) || betaPattern.test(version) || privatePattern.test(version)) {
    return true;
  }

  return false;
}

/**
 * 快速构建配置
 *
 * 当前支持的参数：--beta，使用方式：node build.mjs --beta
 */
export const getQuickConfigMap = (mirrorMap, npmTag) => {
  const keys = Object.keys(mirrorMap);
  const firstMirrorType = keys[0];

  const configMap = {
    [TagMap.beta]: {
      npmTag: TagMap.beta,
      changeVersionType: ChangeVType.auto,
      version: '',
      updateVersionType: 'prerelease',
      mirrorType: firstMirrorType,
    },
  };

  return configMap[npmTag];
};

/**
 * 获取版本更新方式问题配置
 */
export const getQuestionTag = (projectName) => {
  const choices = [];

  for (let key in TagMap) {
    choices.push(key);
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
    {
      type: 'list',
      name: 'changeVersionType',
      message: `选择更新版本方式，规则如下：
      auto: 基于Npm Version自动演进版本
      manual: 手动输入版本`,
      choices: [ChangeVType.auto, ChangeVType.manual],
      default: ChangeVType.auto,
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
    name: 'version',
    message: `请输入需要发布的版本号，规则如下：
      正式版本：[MAJOR.MINOR.PATCH]
      测试版本：[MAJOR.MINOR.PATCH-beta.BUILD]
      私有版本：[MAJOR.MINOR.PATCH-private.BUILD]\n`,
    validate: (version) => {
      if (validateVersion(version)) {
        return true;
      }

      return '版本号不符合规则，请重新输入';
    },
  },
];

/**
 * 获取更新版本的方式问题配置
 */
export const QuestionSwitchVersion = (npmTag) => {
  return [
    {
      type: 'list',
      name: 'updateVersionType',
      message: `请选择版本更新规则，规则如下：
        [MAJOR, MINOR, PATCH-${npmTag}.BUILD]
        prerelease(常规更新): 1.0.0 -> 1.0.1-${npmTag}.0 -> 1.0.1-${npmTag}.1,
        patch(小版本): v1.0.0-${npmTag}.0 -> v1.0.0
        prepatch: 1.0.0-${npmTag}.0 -> 1.0.1-${npmTag}.0
        minor(次版本): 1.0.0 -> 1.1.0
        preminor: 1.0.0-${npmTag}.0 -> 1.1.0-${npmTag}.0
        major(大版本): 1.0.0 -> 2.0.0
        premajor: 1.0.0-${npmTag}.0 -> 2.0.0-${npmTag}.0`,
      choices: ['prerelease', 'patch', 'minor', 'major', 'prepatch', 'preminor', 'premajor'],
    },
  ];
};

/**
 * 获取使用镜像方式配置
 */
export const getQuestionMirrorType = (mirrorMap) => {
  const choices = [];
  let message = '请选择镜像：';

  for (let key in mirrorMap) {
    choices.push(key);
    message += `\n${key}镜像: ${mirrorMap[key]}`;
  }

  const QuestionMirrorType = [
    {
      type: 'list',
      name: 'mirrorType',
      message,
      choices: choices,
    },
  ];

  return QuestionMirrorType;
};

/**
 * 获取PackageJson文件内容
 */
export const readePackageJson = () => {
  const packagePath = path.join(process.cwd(), 'package.json');
  const packageJson = fs.readFileSync(packagePath, 'utf8');
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
export const updatePackageJsonVersion = (version) => {
  const packagePath = path.join(process.cwd(), 'package.json');
  const packageJson = fs.readFileSync(packagePath, 'utf8');
  const packageJsonObj = JSON.parse(packageJson);

  packageJsonObj.version = version;
  fs.writeFileSync(packagePath, JSON.stringify(packageJsonObj, null, 2) + '\n', 'utf8');

  return true;
};

/**
 * 获取当前分支
 */
export const getCurrentBranch = () => {
  return execShell(gitCurrentBranch);
};

export class Logger {
  static log(key, value, ...rest) {
    console.log(chalk.dim(key, value, rest));
  }

  static cyan(key, value, ...rest) {
    console.log(chalk.cyanBright(key, value, rest));
  }

  static green(key, value, ...rest) {
    const emoji = getEmoji();
    console.log(chalk.green(emoji, key, value, rest));
  }

  static error(key, value, ...rest) {
    const emoji = '❌';
    console.log(chalk.red(emoji, key, value, rest));
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
