'use strict';

exports.command = 'contrib <org..>';

exports.describe =
  'Gather contribution statistics for one or more GitHub orgs.';

exports.builder = function contribBuilder (yargs) {
  return yargs
    .usage('$0 contrib <org..>')
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
  const client = require('../github')
    .createClient({
      host: argv.host,
      verbose: argv.verbose
    });
  client.contributions({
    external: argv.external,
    private: argv.private,
    orgs: argv.org
  })
    .then(data => JSON.stringify(data, null, 2))
    .then(json => console.log(json));
};
