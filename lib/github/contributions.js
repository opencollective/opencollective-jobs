'use strict';

const _ = require('lodash/fp');

const defaultConfig = Object.freeze({
  org: 'OpenCollective'
});

const applyDefaultConfig = _.defaults(defaultConfig);

const contributionsForOrg = _.curry((client, options) => {
  return client.repos.getForOrgAsync(applyDefaultConfig(options));
});

contributionsForOrg.defaultConfig = defaultConfig;

module.exports = contributionsForOrg;
