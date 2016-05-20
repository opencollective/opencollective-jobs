'use strict';

const _ = require('lodash/fp');

const applyDefaults = _.defaultsDeep({
  org: 'OpenCollective'
});

function contributionsForOrg(client, options) {
  return client.repos.getFromOrgAsync(applyDefaults(options));
}

module.exports = _.curry(contributionsForOrg);
