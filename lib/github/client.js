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
     *
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
      this.log.verbose('github:client:get-repo',
        `Getting info for repo "${options.user}/${options.repo}"`);
      return this.repos.getAsync(options);
    }),
    /**
     *
     * @param opts
     * @param opts.org
     * @returns {*}
     */
    reposForOrg (opts) {
      opts = opts || {};
      this.log.verbose('github:client:repos-for-org',
        `Getting repos for org "${opts.org}"`);
      return this.getAllPagesAsync(this.repos.getForOrg, opts)
        .then(noContentToArray)
        .tap(repos => this.log.verbose('github:client:repos-for-org',
          `Found ${repos.length} repos in org "${opts.org}"`))
        .map(repo => repo.name);
    },
    /**
     *
     * @param opts
     * @param opts.user
     * @param opts.repo
     * @returns {*}
     */
    contributorsForRepo (opts) {
      opts = opts || {};
      this.log.verbose('github:client:contributors-for-repo',
        `Getting contributors for repo "${opts.user}/${opts.repo}"`);
      return this.getAllPagesAsync(this.repos.getContributors, opts)
        .then(noContentToArray)
        .tap(contributors => this.log.verbose(
          'github:client:contributors-for-repo',
          `Found ${contributors.length} contributors for repo "${opts.user}/${opts.repo}"`))
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
      // TODO paginate
      opts = opts || {};
      const orgName = opts.org;
      const isPrivate = Boolean(opts.private);

      this.log.verbose('github:client:members-of-org',
        `Fetching PUBLIC${isPrivate
          ? ' and PRIVATE'
          : ''} members of org "${orgName}"`);

      return this.getAllPagesAsync(this.orgs[isPrivate
        ? 'getMembersAsync'
        : 'getPublicMembersAsync'], {org: orgName})
        .then(noContentToArray) // case: no public members
        .tap(members => this.log.verbose('github:client:members-of-org',
          `Found ${members.length} PUBLIC${isPrivate
            ? ' and PRIVATE'
            : ''} members in org "${opts.org}"`))
        .map(member => member.login);
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
      const orgNames = opts.orgs;
      this.log.verbose('github:client:contributors-in-org',
        `Processing ${orgNames.length} org(s)`);

      const orgData = {};
      return Promise.each(orgNames, org => {
        orgData[org] = {};
        this.log.verbose('github:client:contributors-in-org',
          `Fetching contributors to repos in org "${org}"`);

        return this.reposForOrg({
          org: org,
          type: opts.private ? 'all' : 'public'
        })
          .then(noContentToArray)
          .tap(repoNames => this.pushLogger(this.log.newItem('repos',
            repoNames.length * 2)))
          .map(repoName => this.getRepo({
            repo: repoName,
            user: org
          })
            .tap(() => this.log.completeWork(1)), {concurrency: 1})
          .map(repo => {
            const repoName = repo.name;
            const contributors = {};
            const repoData = {
              stars: repo.stargazers_count,
              contributors: contributors
            };
            return this.contributorsForRepo({
              user: org,
              repo: repoName
            })
              .then(contributions => {
                contributions.forEach(contribution => {
                  contributors[contribution.user] = contribution.contributions;
                });
                orgData[org][repoName] = repoData;
              })
              .tap(() => this.log.completeWork(1));
          }, {concurrency: 1})
      })
        .return(orgData);
    },
    /**
     *
     * @param opts
     * @param opts.user
     * @param {Array} [opts.types=['PushEvent', 'PullRequestEvent']] Array of
     *   allowed event types
     * @see https://developer.github.com/v3/activity/events/types/
     * @returns {*}
     */
    eventsForUser (opts) {
      const types = _.map(type => type.toLowerCase(), opts.types);

      this.log.verbose('github:client:events-for-user',
        `Getting events for user "${opts.user}"`);

      const isIncluded = _.pipe(_.get('type'),
        (type) => types.includes(type.toLowerCase()));
      return this.getAllPagesAsync(this.activity.getEventsForUser, opts)
        .filter(isIncluded);
    },
    /**
     *
     * @param opts
     * @param opts.orgs
     * @param opts.eventTypes
     * @param opts.private
     */
    orgMemberContributions (opts) {
      const options = _.defaults({
        eventTypes: [
          'PushEvent',
          'PullRequestEvent'
        ],
        orgs: []
      }, opts || {});

      const notFound = _.curry((repoName, err) => {
        const e = JSON.parse(err);
        if (e.message === 'Not Found') {
          this.log.warn(`Repo "${repoName} not found; it may have been removed`);
          return null;
        }
        return Promise.reject(new Error(e.message));
      });

      const eventTypes = options.eventTypes;
      this.pushLogger(this.log.newGroup('orgs'));
      return Promise.map(options.orgs, org => {
        this.log.verbose('github:client:org-member-contributions',
          `Fetching EXTERNAL contributions for members of org "${org}"`);
        return this.membersOfOrg({
          org: org,
          private: options.private
        })
          .tap(members => {
            this.log.verbose('github:client:org-member-contributions',
              `Found ${members.length} PUBLIC${options.private
                ? ' and PRIVATE'
                : ''} member(s) in org "${org}"; gathering events of type ${eventTypes.map(
                type => `"${type}"`)
                .join(' OR ')} for last 90 days or 300 events (whichever comes first)`);
            this.pushLogger(this.log.newItem('members', members.length));
          })
          .map(user => this.eventsForUser({
            user: user,
            org: org,
            types: eventTypes
          })
            .tap(() => {
              this.log.completeWork(1);
            }), {concurrency: 1})
          .tap(() => {
            this.log.finish();
            this.popLogger();
          })
          .then(_.flatten)
          .then(events => {
            const uniqueRepos = new Set(_.map(_.get('repo.name'), events));
            const membersByRepo = {};
            _.forEach(event => {
              const repoName = event.repo.name;
              const members = _.getOr({}, repoName, membersByRepo);
              const count = _.getOr(0, event.actor.login, members);
              members[event.actor.login] = count + 1;
              membersByRepo[repoName] = members;
            }, events);
            this.pushLogger(this.log.newItem('repos', uniqueRepos.size));
            return Promise.map(uniqueRepos, repoName => this.getRepo(repoName)
              .catch(notFound(repoName))
              .then(repo => {
                if (!repo) {
                  return null;
                }
                if (repo.source) {
                  const sourceRepoName = repo.source.full_name;
                  const user = _.head(sourceRepoName.split('/'));
                  if (user.toLowerCase() === org.toLowerCase()) {
                    this.log.verbose('github:client:org-member-contributions',
                      `Repo "${repoName}" is a fork of an org project ("${sourceRepoName}"); discarding`);
                    return null;
                  }
                  if (uniqueRepos.has(sourceRepoName)) {
                    this.log.verbose('github:client:org-member-contributions',
                      `Repo "${repoName}" is a fork of a non-org project ("${sourceRepoName}"); continuing`);
                    membersByRepo[sourceRepoName] = membersByRepo[repoName];
                    return null;
                  }
                  this.log.verbose('github:client:org-member-contributions',
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
                  this.log.verbose('github:client:org-member-contributions',
                    `Repo "${repoName}" is a an org project; discarding`);
                  return null;
                }
                return repo;
              })
              .tap(() => {
                this.log.completeWork(1);
              }), {concurrency: 1})
              .tap(() => {
                this.log.finish();
                this.popLogger();
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
    },
    /**
     *
     * @param log
     * @returns {*}
     */
    pushLogger (log) {
      this.loggingContext.push(log);
      return log;
    },
    /**
     *
     * @returns {*}
     */
    popLogger () {
      return this.loggingContext.length > 1
        ? this.loggingContext.pop()
        : _.head(this.loggingContext);
    },
    /**
     *
     */
    withLogger: Promise.method(function withLogger (promise, log) {
      this.pushLogger(log);
      return promise.finally(() => {
        this.log.finish();
        this.popLogger();
      });
    })
  },
  init (context) {
    const instance = context.instance;

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
  .init(function initLogger (context) {
    // init logger
    this.loggingContext = [];
    this.pushLogger(rootLog);

    Object.defineProperty(this, 'log', {
      get () {
        return _.last(this.loggingContext);
      }
    });

    this.log.debug('github:client',
      'Created GitHub client with options %j',
      _.head(context.args));
  })
  .init(function initAuth () {
    // authentication setup
    const env = process.env;
    // noinspection IfStatementWithTooManyBranchesJS
    if (env.GITHUB_OAUTH_TOKEN) {
      this.log.info('github:client',
        'Configuring authentication via OAuth2 token');
      this.authenticate({
        type: 'oauth',
        token: env.GITHUB_OAUTH_TOKEN
      });
    } else if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
      this.log.info('github:client',
        'Configuring authentication via OAuth2 key/secret');
      this.authenticate({
        type: 'oauth',
        key: env.GITHUB_CLIENT_ID,
        secret: env.GITHUB_CLIENT_SECRET
      });
    } else if (env.GITHUB_USERNAME && env.GITHUB_PASSWORD) {
      this.log.info('github:client',
        'Configuring authentication via basic authentication');
      this.authenticate({
        type: 'basic',
        username: env.GITHUB_USERNAME,
        password: env.GITHUB_PASSWORD
      });
    } else {
      this.log.warn('github:client',
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
