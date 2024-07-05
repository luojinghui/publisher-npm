#! /usr/bin/env node
import { program } from 'commander';
import { publisher } from './core/index.mjs';

program.name('Npm Publisher Tool').version('0.0.1', '-v, --version', '[npm publisher version]');

program
  .command('run')
  .description('run npm publisher')
  .option('--config <path>', '[create build.config.js in project root directory]')
  .option('--configIgnore', '[use default config file, not create build.config.json file in project]')
  .option('--beta', '[publish beta version quickly]')
  .action(async (options) => {
    try {
      await publisher.run(options);
    } catch (error) {
      console.log('action error: ', error);

      process.exit(1);
    }
  });

program.parse(process.argv);
