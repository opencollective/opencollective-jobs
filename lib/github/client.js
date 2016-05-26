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
    getRepo (opts) {
      opts = opts || {};
      this.log.verbose('github:client:get-repo',
        `Getting info for repo "${opts.user}/${opts.repo}"`);
      return this.repos.getAsync(opts);
    },
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
      return this.repos.getForOrgAsync(opts)
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
      return this.repos.getContributorsAsync(opts)
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
        `Fetching PUBLIC ${isPrivate
          ? 'and PRIVATE '
          : ''} members of org "${orgName}"`);

      return this.orgs[isPrivate ? 'getMembersAsync' : 'getPublicMembersAsync'](
        {org: orgName})
        .then(noContentToArray) // case: no public members
        .tap(members => this.log.verbose('github:client:members-of-org',
          `Found ${members.length} members in org "${opts.org}"`))
        .map(member => ({user: member.login}));
    },
    /**
     *
     * @param opts
     * @param opts.user
     * @returns {*}
     */
    eventsForUser (opts) {
      opts = opts || {};
      this.log.verbose('github:client:events-for-user',
        `Getting events for user "${opts.user}" for the past three (3) months; please be patient`);
      return this.withLogger(this.paginate(opts),
        this.log.newItem(`member "${opts.user}"`));
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
     * @param opts.orgs
     * @param opts.private
     */
    orgMemberContributions (opts) {
      opts = opts || {};
      return Promise.map(opts.orgs, org => {
        this.log.verbose('github:client:org-member-contributions',
          `Fetching EXTERNAL contributions for org "${org}"`);
        return this.membersOfOrg({
          org: org,
          private: opts.private
        })
          .tap(members => {
            if (opts.private) {
              this.log.verbose('github:client:org-member-contributions',
                `Found ${members.length} PUBLIC and PRIVATE member(s) in org "${org}"; gathering events...`);
            } else {
              this.log.verbose('github:client:org-member-contributions',
                `Found ${members.length} PUBLIC member(s) in org "${org}"; gathering events...`);
            }
          })
          .map(opts => this.eventsForUser({
            user: opts.user,
            external: true,
            org: org
          }), {concurrency: 1})
          .then(reposForUsers => {
            const obj = {};
            const allRepos = new Set();
            reposForUsers.forEach(reposForUser => {
              reposForUser.forEach((value, key) => {
                obj[key] = _.pipe(_.map(data => ({
                    repo: data[0],
                    stars: data[1]
                  })),
                  _.forEach(data => allRepos.add(data.repo)))(
                  Array.from(value));
              });
            });
            this.log.verbose('github:client:org-member-contributions',
              `Member(s) of org "${org}" contributed to ${allRepos.size} unique repo(s).`);

            return obj;
          });
      });
    },
    paginate: Promise.coroutine(function* (opts, reposByUser) {
      reposByUser = reposByUser || new Map();

      const uniqueRepos = reposByUser.has(opts.user)
        ? reposByUser.get(opts.user)
        : new Map();

      reposByUser.set(opts.user, uniqueRepos);

      yield this.activity.getEventsForUserAsync(opts)
        .then(events => {
          if (_.isUndefined(opts.last)) {
            if (_.get('meta.link', events)) {
              const match = /.+http.+?page=(\d+).+?;\srel="last"$/
                .exec(events.meta.link);
              opts.last = parseInt(match[1], 10);
            } else {
              opts.last = opts.page;
            }
            this.log.addWork(opts.last);
          }

          return Promise.filter(events,
            event => event.type === 'PushEvent' ||
            event.type === 'PullRequestEvent');
        })
        .filter(event => event.repo.name.split('/')[0] !== opts.org)
        .map(event => event.repo)
        .each(repo => {
          const nameParts = repo.name.split('/');
          return this.getRepo({
            user: nameParts[0],
            repo: nameParts[1]
          })
            .then(repoData => {
              repo.stars = repoData.stargazers_count;
            });
        })
        .each(repo => uniqueRepos.set(repo.name, repo.stars))
        .tap(() => this.log.completeWork(1));

      if (opts.page < opts.last) {
        opts.page++;
        yield this.paginate(opts, reposByUser);
      }

      return reposByUser;
    }),
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
  });

module.exports = Client;
