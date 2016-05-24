'use strict';

const _ = require('lodash/fp');
const Promise = require('bluebird');
const GitHub = require('github4');
const pkg = require('../../package.json');
const contributions = require('./contrib');
const log = require('../logger');

const defaultConfig = Object.freeze({
  protocol: 'https',
  timeout: 5000,
  headers: {
    'user-agent': `${pkg.name} v${pkg.version}; ${pkg.homepage}`
  }
});

// always ensures version is set to 3.0.0
const applyDefaultConfig = _.flow(_.defaultsDeep(defaultConfig),
  _.assoc('version', '3.0.0'));

function createClient(options) {
  const env = process.env;
  log.debug('github-client', 'Creating GitHub API client with options %j', options);
  const client = new GitHub(applyDefaultConfig(options));

  if (env.GITHUB_OAUTH_TOKEN) {
    log.info('github-client', 'Configuring authentication via OAuth2 token');
    client.authenticate({
      type: 'oauth',
      token: env.GITHUB_OAUTH_TOKEN
    });
  } else if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    log.info('github-client', 'Configuring authentication via OAuth2 key/secret');
    client.authenticate({
      type: 'oauth',
      key: env.GITHUB_CLIENT_ID,
      secret: env.GITHUB_CLIENT_SECRET
    });
  } else if (env.GITHUB_USERNAME && env.GITHUB_PASSWORD) {
    log.info('github-client', 'Configuring authentication via basic authentication');
    client.authenticate({
      type: 'basic',
      username: env.GITHUB_USERNAME,
      secret: env.GITHUB_PASSWORD
    });
  } else {
    log.warn('github-client', 'Connecting to GitHub WITHOUT authentication; may be subject to rate-limiting');
  }

  Promise.promisifyAll(client.repos);
  Promise.promisifyAll(client.orgs);
  Promise.promisifyAll(client.activity);

  return {
    client: client,
    contributions: contributions(client)
  };
}

createClient.defaultConfig = applyDefaultConfig({});

module.exports = createClient;
