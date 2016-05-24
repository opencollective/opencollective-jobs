'use strict';

const github = require('../lib/github');

const plugin = 'github';

function githubPlugin () {
  const seneca = this;

  const client = github.createClient();

  seneca.add({
    role: plugin,
    cmd: 'contributions'
  }, (options, callback) => {
    return client.contributions({
      org: options.org,
      type: options.type,
      external: options.external
    })
      .asCallback(callback);
  });

  return plugin;
}

module.exports = githubPlugin;
