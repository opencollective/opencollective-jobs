'use strict';

const GitHubClient = require('../github');
const log = require('../logger');
const _ = require('lodash');

exports.command = 'helped [options] <org..>';

exports.describe =
  'Find non-org users (and their top recent contributions) whose issues were closed within org repos.';

exports.builder = function contribBuilder (yargs) {
  return yargs
    .usage('$0 helped <org..>')
    .example('$0 helped OpenCollective')
    .demand(2, 'Please specific one or more GitHub orgs!')
    .options({
      limit: {
        default: 10,
        describe: 'Limit the number of unique repos in recent contributions',
        type: 'number'
      }
    });
};

exports.handler = function contrib (argv) {
  log.level = argv.quiet ? 'silent' : argv.loglevel;

  if (argv.progress && !argv.quiet) {
    log.enableProgress();
  }

  const stringify = argv.pretty
    ? _.partialRight(JSON.stringify, null, 2)
    : JSON.stringify;

  return GitHubClient({
    host: argv.host,
  })
    .usersHelped({
      orgs: argv.org,
      limit: argv.limit
    })
    .finally(() => log.disableProgress())
    .then(stringify)
    .then(json => console.log(json));
};
