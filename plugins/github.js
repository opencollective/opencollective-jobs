'use strict';

const github = require('../lib/github');

const plugin = 'github';

function githubPlugin () {
  const seneca = this;

  const client = github.createClient();
  const contributionsForOrg = github.contributionsForOrg(client);

  seneca.add({
    role: plugin,
    cmd: 'contributors'
  }, (options, callback) => {
    return contributionsForOrg(options)
      .asCallback(callback);
  });

  return plugin;
}

module.exports = githubPlugin;
