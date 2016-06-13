'use strict';

const stampit = require('stampit');
const GitHub = require('github4');
const _ = require('lodash/fp');
const Promise = require('bluebird');
const rootLog = require('../logger');
const pkg = require('../../package.json');

/**
 * If GitHub returns a 204, in some cases we must have an Array
 * for Bluebird, so just return one;
 * @param {*} value Whatever GitHub returns
 * @returns {Array} Empty if GH returned zilch
 */
function noContentToArray (value) {
  return _.isArray(value) ? value : [];
}

const Client = stampit({
  props: {
    version: '3.0.0',
    protocol: 'https',
    host: 'api.github.com',
    headers: {}
  },
  methods: {
    /**
     * Error handler if a repo isn't found.  May reject a promise, or just
     * return `null` with a warning.
     * @param repoName
     * @param err
     * @returns {*}
     */
    repoNotFound (repoName, err) {
      let e;
      try {
        e = JSON.parse(err);
        if (e.message === 'Not Found') {
          this.log.warn(
            `Repo "${repoName} not found; it may have been removed`);
          return null;
        }
        return Promise.reject(new Error(e.message));
      } catch (err) {
        return Promise.reject(err);
      }
    },
    /**
     * Dumb wrapper around getting repo info
     * @param opts
     * @param opts.user
     * @param opts.repo
     * @returns {*}
     */
    getRepo: _.memoize(function getRepo (opts) {
      let options;
      if (_.isString(opts)) {
        options = {};
        const parts = opts.split('/');
        options.user = parts[0];
        options.repo = parts[1];
      } else {
        options = opts || {};
      }
      this.log.verbose(`${options.user}/${options.repo}`,
        `Getting info for repo`);
      return this.repos.getAsync(options);
    }),
    /**
     * Gets a repo, but follows forks.
     */
    getSourceRepo: _.memoize(function getSourceRepo (opts) {
      return this.getRepo(opts)
        .catch(err => this.repoNotFound(err))
        .then(repo => {
          if (repo) {
            if (repo.source) {
              return this.getSourceRepo(repo.source.full_name);
            }
            return repo;
          }
          return null;
        });
    }),
    /**
     * Finds all repos in org.
     * @param opts
     * @param {string} opts.org
     * @param {string} [opts.type] Restrict repo type
     * @returns {*}
     */
    reposForOrg (opts) {
      const options = _.isString(opts) ? {
        org: opts
      } : opts || {};

      return this.getAllPagesAsync(this.repos.getForOrg, options)
        .then(noContentToArray)
        .tap(repos => {
          this.log.verbose(opts.org,
            `Found ${repos.length} repos in org "${opts.org}"`);
        });
    },
    /**
     * Gets all users who contributed to a repo
     * @param opts
     * @param opts.user
     * @param opts.repo
     * @returns {*}
     */
    contributorsForRepo (opts) {
      let options;
      if (_.isString(opts)) {
        options = {};
        const parts = opts.split('/');
        options.user = parts[0];
        options.repo = parts[1];
      } else {
        options = opts || {};
      }
      return this.getAllPagesAsync(this.repos.getContributors, options)
        .then(noContentToArray)
        .tap(contributors => {
          this.log.verbose(`${options.user}/${options.repo}`,
            `Found ${contributors.length} contributors`);
        })
        .map(contributor => ({
          user: contributor.login,
          contributions: contributor.contributions
        }));
    },
    /**
     *
     * @param opts
     * @param opts.org
     * @param opts.private
     * @param
     * @returns {*}
     */
    membersOfOrg (opts) {
      opts = opts || {};
      const orgName = opts.org;
      const isPrivate = Boolean(opts.private);

      this.log.verbose(orgName,
        `Fetching PUBLIC${isPrivate
          ? ' and PRIVATE'
          : ''} members of org "${orgName}"`);

      return this.getAllPagesAsync(this.orgs[isPrivate
        ? 'getMembers'
        : 'getPublicMembers'], {org: orgName})
        .then(noContentToArray) // case: no public members
        .tap(members => this.log.verbose(orgName,
          `Found ${members.length} PUBLIC${isPrivate
            ? ' and PRIVATE'
            : ''} members`))
        .map(member => member.login);
    },
    /**
     * Finds users who have created issues in an org's repo, and those issues
     * were closed, and had `minimumCommentCount` comments, and then return
     * recent contributions to non-org repos for that user.
     * @param opts
     * @returns {Promise.<TResult>|*}
     */
    usersHelped (opts) {
      const options = _.defaults({
        orgs: [],
        minimumCommentCount: 2
      }, opts || {});
      const helpedLog = this.log.newGroup('helped');
      const contributions = new Map();
      const nonMembers = new Map();
      let repoLog;
      let issueLog;
      return this.forEachOrg(options.orgs, (org, log) => {
        log.verbose(org, 'Getting repos');
        return this.reposForOrg({org})
          .tap(repos => {
            repoLog = helpedLog.newItem(org, repos.length);
          })
          .map(repo => {
            const repoName = repo.name;
            repoLog.verbose(repoName, 'Getting issues');
            return this.getAllPagesAsync(this.issues.getForRepoAsync, {
              user: org,
              repo: repoName,
              state: 'closed'
            })
              .filter(issue => issue.comments >= options.minimumCommentCount)
              .filter(issue => {
                const user = issue.user.login;
                if (nonMembers.has(user)) {
                  return nonMembers.get(user);
                }
                repoLog.verbose(user, `Checking membership`);
                return this.orgs.checkMembershipAsync({
                  org,
                  user
                })
                  .then(() => {
                    repoLog.verbose(user, `Member of org "${org}"; skipping`);
                    nonMembers.set(user, false);
                    return false;
                  })
                  .catch(() => {
                    repoLog.verbose(user, `NOT member of org "${org}"`);
                    nonMembers.set(user, true);
                    return true;
                  });
              }, {concurrency: 1})
              .tap(issues => {
                issueLog = helpedLog.newItem(repoName, issues.length);
              })
              .map(issue => {
                const user = issue.user.login;
                if (contributions.has(user)) {
                  issueLog.completeWork(1);
                  return;
                }
                return this.userContributions(_.assign({
                  user,
                  log: issueLog,
                  exclude: org
                }, options))
                  .tap(data => {
                    issueLog.completeWork(1);
                    contributions.set(user, data);
                  });
              }, {concurrency: 1});
          }, {concurrency: 1})
          .tap(() => {
            repoLog.completeWork(1);
          });
      }, helpedLog)
        .then(() => {
          const data = {};
          contributions.forEach((info, user) => {
            data[user] = info;
          });
          return data;
        });
    },
    /**
     * A somewhat useful wrapper to execute code for a list of orgs
     * @private
     * @param orgNames
     * @param func
     * @param groupLog
     * @param opts
     */
    forEachOrg (orgNames, func, groupLog, opts) {
      opts = opts || {};
      groupLog.verbose('orgs', `Processing ${orgNames.length} org(s)`);
      const log = groupLog.newItem('orgs', orgNames.length);
      opts = _.defaults({
        concurrency: 1
      }, opts || {});
      return Promise.map(orgNames, org => Promise.method(func)(org, log)
        .finally(() => {
          log.completeWork(1);
        }), opts)
        .finally(() => {
          log.finish();
        });
    },
    /**
     *
     * @param opts
     * @param opts.orgs
     * @param opts.private
     */
    contributorsInOrg (opts) {
      opts = _.defaults({
        orgs: [],
        private: false
      }, opts || {});
      const data = {};
      const contribLog = this.log.newGroup('contrib');
      return this.forEachOrg(opts.orgs, (org, log) => {
        data[org] = {};
        log.verbose(org, `Fetching contributors to repos in org "${org}"`);

        return this.reposForOrg({
          org: org,
          type: opts.private ? 'all' : 'public'
        })
          .catch(e => {
            const err = JSON.parse(e);
            if (err.message === 'Not Found') {
              return Promise.reject(new Error(`Org ${org} not found`));
            }
            throw new Error(err);
          })
          .then(noContentToArray)
          // don't inspect forks
          .filter(repo => {
            if (repo.fork) {
              log.warn(org, `Skipping fork "${repo.name}"`);
              return false;
            }
            return true;
          })
      }, contribLog)
        .then(_.flatten)
        .then(repos => {
          const repoLog = contribLog.newItem('repos', repos.length);
          return Promise.map(repos, repo => {
            const contributors = {};
            const repoData = {
              stars: repo.stargazers_count,
              contributors: contributors
            };
            return this.contributorsForRepo(repo.full_name)
              .then(contributions => {
                contributions.forEach(contribution => {
                  contributors[contribution.user] = contribution.contributions;
                });
                data[repo.owner.login.toLowerCase()][repo.name] = repoData;
              })
              .tap(() => {
                repoLog.completeWork(1);
              });
          }, {concurrency: 1})
            .finally(() => {
              repoLog.finish();
            });
        })
        .finally(() => {
          contribLog.finish();
        })
        .return(data)
    },
    /**
     * Gets recent contributions for user; returns repos with # of stars
     * @private
     * @param opts
     * @param {number} [opts.limit=Infinity] Return no more than this many
     *   repos in data
     * @param {string} [opts.sortBy='stargazers_count'] Repo field to sort by.
     *   See GitHub API for valid fields.
     * @param {string} [opts.sortOrder='desc'] Sort order
     * @param {string} [opts.excluded] Org/owner name to be excluded from
     *   result, if any
     * @returns {*}
     */
    userContributions (opts) {
      if (_.isString(opts)) {
        opts = {
          user: opts
        };
      }
      const options = _.defaults({
        limit: Infinity,
        sortBy: 'stargazers_count',
        sortOrder: 'desc',
        log: this.log
      }, opts);
      const user = options.user;
      const log = options.log;
      const getRepoName = _.get('repo.name');
      log.verbose(user, 'Getting contribution events');

      return this.userContributionEvents({
        user,
        eventTypes: options.eventTypes,
        log
      })
        .map(getRepoName)
        .map(repoName => this.getSourceRepo(repoName), {concurrency: 1})
        .filter(_.identity)
        .filter(repo => repo.full_name.split('/')[0].toLowerCase() !==
        options.excluded.toLowerCase())
        .then(_.pipe(_.orderBy(options.sortBy, options.sortOrder),
          _.sortedUniqBy('full_name'), _.map(_.pick([
            'full_name',
            'stargazers_count'
          ])), _.map(repo => ({
            name: repo.full_name,
            stars: repo.stargazers_count
          })), _.take(options.limit)));
    },
    /**
     * Returns raw contribution events for a user
     * @param opts
     * @param opts.user
     * @param {Array} [opts.eventTypes=['PushEvent', 'PullRequestEvent']] Array
     *   of allowed event types
     * @see https://developer.github.com/v3/activity/events/types/
     * @private
     * @returns {*}
     */
    userContributionEvents (opts) {
      const options = _.defaults({
        log: this.log,
        eventTypes: [
          'PushEvent',
          'PullRequestEvent'
        ]
      }, opts);

      const log = options.log;
      const types = _.map(_.lowerCase, options.eventTypes);
      const user = options.user;
      log.verbose(user, `Getting events of type(s): ${types.join(', ')}`);

      const isIncluded = _.pipe(_.get('type'),
        type => types.indexOf(_.lowerCase(type)) >= 0);
      return this.getAllPagesAsync(this.activity.getEventsForUser, options)
        .filter(isIncluded);
    },
    /**
     *
     * @param opts
     * @param opts.orgs
     * @param opts.eventTypes
     * @param opts.private
     */
    orgMemberContributions(opts) {
      const options = _.defaults({
        orgs: []
      }, opts || {});

      const eventTypes = options.eventTypes;
      const orgLog = this.log.newGroup('orgs');
      return Promise.map(options.orgs, org => {
        let memberLog;
        orgLog.verbose(org, `Fetching EXTERNAL contributions of members`);
        return this.membersOfOrg({
          org: org,
          private: options.private
        })
          .tap(members => {
            orgLog.verbose(org,
              `Found ${members.length} PUBLIC${options.private
                ? ' and PRIVATE'
                : ''} member(s); gathering events of type ${eventTypes.map(
                type => `"${type}"`)
                .join(' OR ')} for last 90 days or 300 events (whichever comes first)`);
            memberLog = orgLog.newItem('members', members.length);
          })
          .map(user => this.userContributionEvents({
            user: user,
            types: eventTypes
          })
            .tap(() => {
              memberLog.completeWork(1);
            }), {concurrency: 1})
          .then(_.flatten)
          .then(events => {
            memberLog.finish();
            const uniqueRepos = new Set(_.map(_.get('repo.name'), events));
            const repoLog = orgLog.newItem('repos', uniqueRepos.size);
            const membersByRepo = {};
            _.forEach(event => {
              const repoName = event.repo.name;
              const user = event.actor.login;
              const members = _.getOr({}, repoName, membersByRepo);
              const count = _.getOr(0, user, members);
              members[user] = count + 1;
              membersByRepo[repoName] = members;
            }, events);
            return Promise.map(uniqueRepos, repoName => this.getRepo(repoName)
              .catch(err => this.repoNotFound(repoName, err))
              .filter(_.identity)
              .then(repo => {
                if (repo.source) {
                  const sourceRepoName = repo.source.full_name;
                  const user = _.head(sourceRepoName.split('/'));
                  if (user.toLowerCase() === org.toLowerCase()) {
                    repoLog.verbose(repoName,
                      `Repo "${repoName}" is a fork of an org project ("${sourceRepoName}"); discarding`);
                    return null;
                  }
                  if (uniqueRepos.has(sourceRepoName)) {
                    repoLog.verbose(repoName,
                      `Repo "${repoName}" is a fork of a non-org project ("${sourceRepoName}"); continuing`);
                    membersByRepo[sourceRepoName] =
                      _.merge(membersByRepo[sourceRepoName],
                        membersByRepo[repoName]);
                    return null;
                  }
                  repoLog.verbose(repoName,
                    `Repo "${repoName}" is a fork of a non-org project ("${sourceRepoName}"); getting more info`);
                  return this.getRepo(sourceRepoName)
                    .then(repo => {
                      membersByRepo[sourceRepoName] = membersByRepo[repoName];
                      uniqueRepos.add(sourceRepoName);
                      return repo;
                    })
                    .catch(notFound(sourceRepoName));
                }
                const user = _.head(repo.full_name.split('/'));
                if (user.toLowerCase() === org.toLowerCase()) {
                  repoLog.verbose(repoName,
                    `Repo "${repoName}" is a an org project; discarding`);
                  return null;
                }
                return repo;
              })
              .tap(() => {
                repoLog.completeWork(1);
              }), {concurrency: 1})
              .finally(() => {
                repoLog.finish();
              })
              .then(_.compact)
              .each(repo => {
                repo.contributors = membersByRepo[repo.full_name];
                repo.stars = repo.stargazers_count;
              })
              .map(_.pick([
                'contributors',
                'stars',
                'full_name'
              ]))
              .then(_.keyBy('full_name'))
              .then(_.mapValues(_.omit('full_name')));
          });
      }, {concurrency: 1});
    }
  },
  init(context) {
    const instance = context.instance;

    if (this.logLevel) {
      rootLog.level = this.logLevel;
    }
    this.log = rootLog;

    // you can change this value, but please don't remove it
    instance.headers['user-agent'] =
      `${pkg.name} v${pkg.version}; ${pkg.homepage}`;
    instance.debug = rootLog.level === 'debug';

    // reset args and pass them into original GitHub constructor
    context.args.length = 0;
    context.args.push(_.clone(instance));

    // remove defaults from instance; let GitHub constructor handle them thru
    // args
    _.pipe(_.keys,
      _.forEach(key => delete instance[key]))(
      context.stamp.fixed.props);
  }
})
  .compose(stampit.convertConstructor(GitHub))
  .init(function initAuth (context) {
    this.log.debug('client',
      'Created GitHub client with options %j',
      _.head(context.args));

    // authentication setup
    const env = process.env;
    // noinspection IfStatementWithTooManyBranchesJS
    if (env.GITHUB_OAUTH_TOKEN) {
      this.log.info('client', 'Configuring authentication via OAuth2 token');
      this.authenticate({
        type: 'oauth',
        token: env.GITHUB_OAUTH_TOKEN
      });
    } else if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
      this.log.info('client',
        'Configuring authentication via OAuth2 key/secret');
      this.authenticate({
        type: 'oauth',
        key: env.GITHUB_CLIENT_ID,
        secret: env.GITHUB_CLIENT_SECRET
      });
    } else if (env.GITHUB_USERNAME && env.GITHUB_PASSWORD) {
      this.log.info('client',
        'Configuring authentication via basic authentication');
      this.authenticate({
        type: 'basic',
        username: env.GITHUB_USERNAME,
        password: env.GITHUB_PASSWORD
      });
    } else {
      this.log.warn('client',
        'Connecting to GitHub WITHOUT authentication; may be subject to rate-limiting.  See README.md for necessary environment variables');
    }
  })
  .init(function initPromisify () {
    // promisify the APIs
    _.pipe(_.omit([
      'config',
      'headers',
      'routes',
      'debug',
      'constants',
      'requestHeaders',
      'responseHeaders'
    ]), _.pickBy(_.isObject), _.forEach(Promise.promisifyAll))(this);
    // pick up some extra methods like `getAllPages()`
    Promise.promisifyAll(this);
  });

module.exports = Client;
