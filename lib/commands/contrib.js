'use strict';

const GitHubClient = require('../github');
const log = require('../logger');

exports.command = 'contrib [options] <org..>';

exports.describe =
  'Gather contribution statistics for one or more GitHub orgs.';

exports.builder = function contribBuilder (yargs) {
  return yargs
    .usage('$0 contrib <org..>')
    .example('$0 contrib --external OpenCollective',
      'Output all non-org repos that members of the OpenCollective org have contributed to recently')
    .example('$0 contrib --private mochajs yeoman',
      'Output all contributions org repos by public and private members of orgs "mochajs" and "yeoman"')
    .demand(2, 'Please specific one or more GitHub orgs!')
    .options({
      external: {
        alias: 'e',
        default: false,
        describe: 'Find non-org contributions by org members',
        type: 'boolean'
      },
      private: {
        default: false,
        describe: 'Report contributions to private repos',
        type: 'boolean'
      },
      host: {
        describe: 'Host if not api.github.com (for GitHub Enterprise)',
        type: 'string',
        default: 'api.github.com'
      }
    });
};

exports.handler = function contrib (argv) {
  log.level = argv.quiet ? 'silent' : argv.loglevel;

  if (argv.progress && !argv.quiet) {
    log.enableProgress();
  }

  const client = GitHubClient({
    host: argv.host
  });

  const method = argv.external ? 'orgMemberContributions' : 'contributorsInOrg';

  return client[method]({
    orgs: argv.org,
    private: argv.private,
    eventTypes: argv.types
  })
    .finally(() => log.disableProgress())
    .then(data => argv.pretty
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data))
    .then(json => console.log(json));
};
