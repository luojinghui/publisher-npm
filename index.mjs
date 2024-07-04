#! /usr/bin/env node
import { program } from 'commander';
import { publisher } from './core/index.mjs';

program.name('Npm Publisher Tool').version('0.0.1', '-v, --version', '[npm publisher version]');

program
  .command('run')
  .description('run npm publisher')
  .option('--config <path>', '[create build.config.js in project root directory]')
  .option('--beta', '[publish beta version quickly]')
  .action((options) => {
    publisher.run(options);
  });

program.parse(process.argv);
