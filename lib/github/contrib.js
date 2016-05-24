'use strict';

const _ = require('lodash/fp');
const Promise = require('bluebird');
const log = require('../logger');

/**
 * If GitHub returns a 204, in some cases we must have an Array
 * for Bluebird, so just return one;
 * @param {*} value Whatever GitHub returns
 * @returns {Array} Empty if GH returned zilch
 */
function noContentToArray(value) {
  return !_.isArray(value) ? [] : value;
}

const reposForOrg = _.curry(
  (client, options) => client.repos.getForOrgAsync(options)
    .then(noContentToArray)
    .map(repo => ({
      repo: repo.name,
      user: options.org
    })));

const contributorsForRepo = _.curry((client, options) => {
  return client.repos.getContributorsAsync(options)
    .then(noContentToArray)
    .map(contribution => ({
      user: contribution.login,
      contributions: contribution.contributions
    }));
});

const membersForOrg = _.curry((client, options) => {
  let task;
  if (options.public) {
    log.verbose('contributions',
      `Fetching PUBLIC members of org "${options.org}"`);
    task = client.orgs.getMembersPublicAsync({
      org: options.org
    });
  } else {
    log.verbose('contributions',
      `Fetching PUBLIC and PRIVATE members of org "${options.org}"`);
    task = client.orgs.getMembersAsync({org: options.org});
  }

  return task.map(member => ({user: member.login}));
});

const contributions = _.curry((client, options) => {
  const opts = _.defaults(contributions.defaultConfig, options);
  log.verbose('contributions', `${opts.orgs.length} org(s) to process`);
  if (opts.external) {
    return Promise.map(opts.orgs, org => {
      log.verbose('contributions',
        `Fetching EXTERNAL contributions for org "${org}"`);
      const membersLog = log.newGroup('members');
      return membersForOrg(client, {
        org: org,
        public: opts.public
      })
        .tap(members => {
          if (opts.public) {
            log.verbose('contributions',
              `Found ${members.length} PUBLIC member(s) in org "${org}"; gathering events...`);
          } else {
            log.verbose('contributions',
              `Found ${members.length} PUBLIC and PRIVATE member(s) in org "${org}"; gathering events...`);
          }
          log.enableProgress();
        })
        .map(opts => eventsForUser(client, {
          user: opts.user,
          membersLog: membersLog,
          external: true,
          org: org
        }), {concurrency: 1})
        .tap(() => log.disableProgress())
        .then(reposForUsers => {
          const obj = {};
          const allRepos = new Set();
          reposForUsers.forEach(reposForUser => {
            reposForUser.forEach((value, key) => {
              obj[key] = Array.from(value);
              obj[key].forEach(repo => allRepos.add(repo));
            });
          });
          log.verbose('contributions',
            `Member(s) of org "${org}" contributed to ${allRepos.size} unique repo(s).`);
          return obj;
        });
    });
  } else {
    const orgData = {};
    return Promise.each(opts.orgs, org => {
      orgData[org] = {};
      log.verbose('contributions',
        `Fetching INTERNAL (member-only) contributions for org "${org}"; finding internal ${opts.private
          ? 'PRIVATE and PUBLIC'
          : 'PUBLIC'} repos...`);
      let repoLog;
      return reposForOrg(client, {
        org: org,
        type: opts.private ? 'all' : 'public'
      })
        .tap(repos => {
          log.verbose('contributions', `${repos.length} ${opts.private
            ? 'PRIVATE and PUBLIC'
            : 'PUBLIC'} repo(s) found`);
          log.enableProgress();
          repoLog = log.newItem('repos', repos.length);
        })
        .map(slug => {
          const repoData = {};
          return contributorsForRepo(client, slug)
            .then(contributions => {
              repoLog.completeWork(1);
              contributions.forEach(contribution => {
                repoData[contribution.user] = contribution.contributions;
              });
              orgData[org][slug.repo] = repoData;
            });
        }, {concurrency: 1})
        .tap(() => log.disableProgress());
    })
      .return(orgData);
  }
});

contributions.defaultConfig = Object.freeze({
  private: false,
  external: false,
  orgs: []
});

const paginate = Promise.coroutine(function* (client, opts, reposByUser) {
  reposByUser = reposByUser || new Map();

  const uniqueRepos = reposByUser.has(opts.user)
    ? reposByUser.get(opts.user)
    : new Set();

  reposByUser.set(opts.user, uniqueRepos);

  const newEvents = yield Promise.delay(5000)
    .then(() => client.activity.getEventsForUserAsync(opts))
    .tap(events => {
      let eventRepos = Promise.filter(events, event => event.type ===
      'PushEvent' ||
      event.type ===
      'PullRequestEvent')
        .map(event => event.repo.name);
      if (opts.external) {
        eventRepos = eventRepos.filter(repo => repo.split('/')[0] !== opts.org);
      }
      return eventRepos.each(repo => uniqueRepos.add(repo));
    })
    .tap(() => opts.log.completeWork(1));

  if (newEvents.length === opts.per_page || opts.page < 10) {
    opts.page++;
    yield paginate(client, opts, reposByUser);
  }

  opts.log.finish();
  return reposByUser;
});

const eventsForUser = _.curry((client, options) => {
  const opts = _.defaults(eventsForUser.defaultConfig, options);
  opts.log = opts.membersLog.newItem(`member "${opts.user}"`, 10);
  return paginate(client, opts);
});

eventsForUser.defaultConfig = Object.freeze({
  per_page: 30,
  page: 1
});

module.exports = contributions;
