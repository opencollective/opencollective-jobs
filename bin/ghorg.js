#!/usr/bin/env node
'use strict';

const logger = require('../lib/logger');

const argv = require('yargs')
  .usage('$0 [options] <command>')
  .option('loglevel', {
    choices: ['debug', 'verbose', 'info', 'warn', 'error'],
    default: 'info',
    describe: 'Choose level of log output (to STDERR)',
    type: 'string',
    global: true
  })
  .option('quiet', {
    describe: 'Suppress all logging output',
    default: false,
    type: 'boolean',
    global: true
  })
  .command(require('../lib/commands/contrib'))
  .demand(1, 'Please specify a command!')
  .showHelpOnFail(true)
  .check(argv => {
    if (argv.quiet) {
      argv.loglevel = 'silent';
    }
    return true;
  })
  .version()
  .help('help').argv;

logger.level = argv.loglevel;

