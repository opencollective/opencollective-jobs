'use strict';

const _ = require('lodash/fp');
const GitHubApi = require('github4');
const pkg = require('../../package.json');
const Promise = require('bluebird');

const defaultConfig = Object.freeze({
  protocol: 'https',
  host: 'api.github.com',
  timeout: 5000,
  headers: {
    'user-agent': `${pkg.name} v${pkg.version}; ${pkg.homepage}`
  },
  debug: process.env.NODE_ENV !== 'production'
});

// always ensures version is set to 3.0.0
const applyDefaultConfig = _.flow(_.defaultsDeep(defaultConfig),
  _.assoc('version', '3.0.0'));

function createClient(options) {
  const client = new GitHubApi(applyDefaultConfig(options));
  return _.mapValues(member => {
    return _.isObject(member) ? Promise.promisifyAll(member) : member;
  }, client);
}

createClient.defaultConfig = applyDefaultConfig({});

module.exports = createClient;
