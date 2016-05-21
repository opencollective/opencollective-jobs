'use strict';

const _ = require('lodash/fp');

const reposForOrg = _.curry((client, options) => {
  return client.repos.getForOrgAsync(options)
    .map(repo => ({
      repo: repo.name,
      user: options.org
    }));
});

const contributorsForRepo = _.curry((client, options) => {
  return client.repos.getContributorsAsync(options)
    .map(contribution => ({
      login: contribution.login,
      repo: options.repo,
      org: options.user,
      contributions: contribution.contributions
    }));
});

const contributionsForOrg = _.curry((client, options) => {
  const opts = _.defaults(contributionsForOrg.defaultConfig, options);
  return reposForOrg(client, opts)
    .map(contributorsForRepo(client));
});

contributionsForOrg.defaultConfig = Object.freeze({
  org: 'OpenCollective',
  type: 'public'
});

module.exports = contributionsForOrg;
