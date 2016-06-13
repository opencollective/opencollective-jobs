#!/usr/bin/env node
'use strict';

require('dotenv').load();

require('yargs')
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
  .option('progress', {
    describe: 'Show progress bar',
    default: true,
    type: 'boolean',
    global: true
  })
  .option('pretty', {
    default: false,
    describe: 'Pretty-print JSON output',
    type: 'boolean',
    global: true
  })
  .option('host', {
    describe: 'Host if not api.github.com (for GitHub Enterprise)',
    type: 'string',
    default: 'api.github.com',
    global: true
  })
  .command(require('../lib/commands/contrib'))
  .command(require('../lib/commands/helped'))
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


