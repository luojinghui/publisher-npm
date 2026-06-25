import { exec } from 'child_process';
import fs from 'fs';
import chalk from 'chalk';
import semver from 'semver';

export const gitTagPushCommand = `git push --tags`;
export const gitAddCommand = 'git add .';
export const gitPush = (branch) => `git push --set-upstream origin ${branch}`;
export const gitCommit = (commit) => `git commit -m "${commit}"`;
export const gitTag = (tagName, tagMsg) => `git tag -a ${tagName} -m "${tagMsg}"`;
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

/** 发布到全部镜像时的虚拟选项 key（不在 mirrorMap 中） */
export const ALL_MIRRORS_KEY = 'all';

export function isAllMirrors(mirrorType) {
  return mirrorType === ALL_MIRRORS_KEY;
}

export function getMirrorTypeList(mirrorMap) {
  return Object.keys(mirrorMap);
}

export function getAvailableMirrorTypeHint(mirrorMap) {
  return [...getMirrorTypeList(mirrorMap), ALL_MIRRORS_KEY].join(', ');
}

export function validateMirrorMapNoAllKey(mirrorMap) {
  if (mirrorMap[ALL_MIRRORS_KEY]) {
    throw new Error(
      `mirrorMap 中不能使用 key "${ALL_MIRRORS_KEY}"，该名称用于发布全部镜像，请修改 build.config.json`,
    );
  }
}

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
  current: 'keep current version (no change)',
  manual: 'manual input version',
};

export const FilterReleaseMap = ['patch', 'minor', 'major', 'current', 'manual'];

export const TaskConfigMap = ['selectTag', 'selectVersion', 'selectMirror', 'commitTag', 'build', 'publish'];

export const manualInputTagString = 'manual input tag';

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
 * Shell 命令执行失败时抛出的错误
 */
export class ExecShellError extends Error {
  constructor(message, { command, exitCode, stdout = '', stderr = '' } = {}) {
    super(message);
    this.name = 'ExecShellError';
    this.command = command;
    this.exitCode = exitCode;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

/**
 * 检测当前项目git是否存在变动
 */
export async function checkUncommittedChanges() {
  try {
    const { stdout } = await execShell(gitStatus);

    if (stdout.trim().length === 0) {
      return true;
    }

    return Promise.reject('Git has not commit changes');
  } catch (error) {
    Logger.error('Git has not commit changes');
    return Promise.reject('Git check error');
  }
}

/**
 * 执行Shell脚本，仅以 exitCode 判定成败（stderr 中的 warn/notice 不算失败）
 *
 * @returns { Promise<{ stdout: string, stderr: string, exitCode: number }> }
 */
export function execShell(command, outputLog = false) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      const out = stdout ?? '';
      const err = stderr ?? '';

      if (outputLog) {
        if (out) {
          console.log('output: ', out);
        }

        if (err) {
          console.log('stderr: ', err);
        }
      }

      if (error) {
        reject(
          new ExecShellError(error.message, {
            command,
            exitCode: error.code ?? 1,
            stdout: out,
            stderr: err,
          }),
        );
        return;
      }

      resolve({ stdout: out, stderr: err, exitCode: 0 });
    });
  });
}

const NPM_PUBLISH_ERROR_MAP = {
  E404: {
    reason: '当前账号无权向 registry 发布该包，或包名在 registry 上不存在',
    fixes: [
      '执行 npm whoami 或 pnpm whoami 确认已登录且账号正确',
      '若包名已被他人占用，改用 scoped 包名（如 @your-org/name）或仅发布到私有镜像',
    ],
  },
  E403: {
    reason: '当前账号没有发布权限（可能被 org 策略或 2FA 限制）',
    fixes: [
      '确认账号对该包有 publish 权限',
      '若启用 2FA，请创建 granular access token 并勾选 bypass 2FA',
      '配置Token：npm config set //registry.npmjs.org/:_authToken=你的token',
    ],
  },
  E401: {
    reason: '未通过 registry 认证',
    fixes: ['执行 npm login 或配置 ~/.npmrc 中的 auth token', '确认 token 未过期且 registry 地址正确'],
  },
  E409: {
    reason: '该版本已存在于 registry，无法重复发布',
    fixes: ['升级版本号后重新发布', '或先在 registry 撤销该版本（unpublish，需谨慎）'],
  },
  UNKNOWN: {
    reason: 'npm 发布失败，请查看上方错误日志',
    fixes: ['检查 registry 地址与网络连接', '查看完整日志: ~/.npm/_logs/'],
  },
};

/**
 * 解析 npm publish 失败输出，生成原因、修复建议与重试命令
 */
export function parseNpmPublishError({ stdout = '', stderr = '', packageName = '', version = '', registry = '' } = {}) {
  const output = `${stdout}\n${stderr}`;
  const codeMatch = output.match(/npm error code (\w+)/i);
  const code = codeMatch?.[1]?.toUpperCase() ?? 'UNKNOWN';
  const registryFromOutput = output.match(/Publishing to (https?:\/\/[^\s]+)/i)?.[1] ?? registry;
  const pkg = packageName && version ? `${packageName}@${version}` : packageName;
  const template = NPM_PUBLISH_ERROR_MAP[code] ?? NPM_PUBLISH_ERROR_MAP.UNKNOWN;

  return {
    code,
    registry: registryFromOutput || registry,
    package: pkg,
    reason: template.reason,
    fixes: template.fixes,
  };
}

/**
 * 打印发布失败诊断信息
 */
export function printPublishFailure(parsed, { mirrorType } = {}) {
  Logger.error('发布失败', `${parsed.package} → ${mirrorType} (${parsed.registry})`);
  Logger.error('原因', `${parsed.reason}（${parsed.code}）`);
  Logger.warn('修复建议：');

  parsed.fixes.forEach((fix, index) => {
    Logger.log(`  ${index + 1}. ${fix}`);
  });
}

/**
 * 生成「仅发布镜像包」的 task 重试参数（版本已提交、publish 失败场景）
 */
export function getPublishRetryTaskCommand({ mirrorType, npmTag }) {
  return `--task publish --mirrorType ${mirrorType} --npmTag ${npmTag}`;
}

/**
 * 版本已提交但发布失败时的善后提示
 */
export function printPartialPublishFailure(version, { mirrorType, npmTag } = {}) {
  Logger.warn(`版本 ${version} 已写入 package.json 并提交 Git，但 npm 发布未成功。`);

  if (mirrorType && npmTag) {
    const retryParams = getPublishRetryTaskCommand({ mirrorType, npmTag });
    Logger.warn('修复问题后，在原发布命令后追加以下参数重试（不升版本、不构建）：');
    Logger.log(`  ${retryParams}`);
  }
}

/**
 * 验证版本规则
 */
export function validateVersion(version) {
  // 正式版本规则
  const officialPattern = /^(\d+)\.(\d+)\.(\d+)$/;
  // Beta版本规则
  const betaPattern = /^(\d+)\.(\d+)\.(\d+)-[a-zA-Z]+\.(\d+)$/;
  // Release版本规则
  const releasePattern = /^(\d+)\.(\d+)\.(\d+)-(\d+)$/;

  if (officialPattern.test(version) || betaPattern.test(version) || releasePattern.test(version)) {
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

  choices.push(manualInputTagString);

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
 * 获取输入NPM TAG方式配置
 */
export const QuestionInputTag = [
  {
    type: 'input',
    name: 'userCustomTag',
    message: `请手动输入NPM Tag`,
    validate: (val) => {
      if (typeof val === 'string') {
        return true;
      }

      return 'NPM Tag仅支持字符串\n';
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
    current: `${ReleaseMap.current}->${currentVersion}`,
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
export const getQuestionMirrorType = (mirrorMap, { includeAll = true } = {}) => {
  const mirrorKeys = getMirrorTypeList(mirrorMap);
  let message = '请选择镜像：';

  for (const key of mirrorKeys) {
    message += `\n${key}: ${mirrorMap[key]}`;
  }

  if (includeAll) {
    message += `\n${ALL_MIRRORS_KEY}: 发布到全部镜像`;
  }

  const choices = includeAll ? [...mirrorKeys, ALL_MIRRORS_KEY] : mirrorKeys;

  return [{ type: 'list', name: 'mirrorType', message, choices }];
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
 * 替换字符串
 *
 * @param { string } originString - 原字符串
 * @param { string } name - 名称
 * @param { string } version - 版本
 * @returns { string } - 替换过后的字符串
 */
export const replaceString = (originString, name = '', version = '') => {
  const str = originString.replace('%s', version);
  const str2 = str.replace('%n', name);

  return str2;
};

/**
 * 获取当前分支
 */
export const getCurrentBranch = async () => {
  const { stdout } = await execShell(gitCurrentBranch);

  return stdout;
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
