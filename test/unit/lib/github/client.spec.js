'use strict';

const Client = require('../../../../lib').GitHubClient;
const _ = require('lodash/fp');
const Promise = require('bluebird');

describe('lib:github:client', () => {
  let sandbox;

  beforeEach(() => {
    // wallaby weirdness; also avoid anything set in user's environment
    if (process.env) {
      delete process.env.GITHUB_OAUTH_TOKEN;
      delete process.env.GITHUB_CLIENT_ID;
      delete process.env.GITHUB_CLIENT_SECRET;
      delete process.env.GITHUB_USERNAME;
      delete process.env.GITHUB_PASSWORD;
    } else {
      process.env = {};
    }
  });

  beforeEach(() => {
    sandbox = sinon.sandbox.create('lib:github:client');
    sandbox.spy(Client.fixed.methods, 'authenticate');
  });

  describe('init', () => {
    let client;

    beforeEach(() => {
      client = Client();
    });

    it('should return a client object', () => {
      expect(client)
        .to
        .have
        .property('contributorsInOrg')
        .that
        .is
        .a('function');
    });

    describe('promisification', () => {
      it('should promisify the client', () => {
        expect(client)
          .to
          .have
          .deep
          .property('repos.getAsync')
          .that
          .is
          .a('function');
      });
    });

    describe('authentication', () => {
      describe('when GITHUB_OAUTH_TOKEN present', () => {
        beforeEach(() => {
          delete process.env.GITHUB_CLIENT_SECRET;
          delete process.env.GITHUB_CLIENT_ID;
          process.env.GITHUB_OAUTH_TOKEN = 'foo';
        });

        it('should init authentication method', () => {
          Client();
          expect(Client.fixed.methods.authenticate)
            .to
            .have
            .been
            .calledWithExactly({
              type: 'oauth',
              token: process.env.GITHUB_OAUTH_TOKEN
            });
        });
      });

      describe('when GITHUB_USERNAME and GITHUB_PASSWORD present', () => {
        beforeEach(() => {
          process.env.GITHUB_USERNAME = 'frick';
          process.env.GITHUB_PASSWORD = 'frack';
          Client();
        });

        it('should init authentication method', () => {
          expect(Client.fixed.methods.authenticate)
            .to
            .have
            .been
            .calledWithExactly({
              type: 'basic',
              username: process.env.GITHUB_USERNAME,
              password: process.env.GITHUB_PASSWORD
            });
        });
      });

      describe('when GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET present', () => {
        beforeEach(() => {
          process.env.GITHUB_CLIENT_ID = 'frick';
          process.env.GITHUB_CLIENT_SECRET = 'frack';
          Client.fixed.methods.authenticate.reset();
          Client();
        });

        it('should init authentication method', () => {
          expect(Client.fixed.methods.authenticate)
            .to
            .have
            .been
            .calledWithExactly({
              type: 'oauth',
              key: process.env.GITHUB_CLIENT_ID,
              secret: process.env.GITHUB_CLIENT_SECRET
            });
        });
      });
    });

    describe('when no config is specified', () => {
      describe('the resulting GitHub API client', () => {
        let client;

        beforeEach(() => {
          client = Client();
        });

        it('should use the default API version', () => {
          expect(client)
            .to
            .have
            .deep
            .property('config.version', '3.0.0');
        });

        it('should use the default URL scheme', () => {
          expect(client)
            .to
            .have
            .deep
            .property('config.protocol', 'https');
        });

        it('should set a default UA', () => {
          expect(client.config.headers)
            .to
            .have
            .property('user-agent');
        });
      });
    });

    describe('when a config is specified, overriding a default property',
      () => {
        let config;

        beforeEach(() => {
          config = {
            version: '2.0.0',
          };
        });

        describe('the resulting GitHub API client', () => {
          let client;

          beforeEach(() => {
            client = Client(config);
          });

          it('should reflect the custom property"', () => {
            expect(client)
              .to
              .have
              .deep
              .property('config.version', '2.0.0');
          });
        });
      });

  });

  describe('method', () => {
    let client;
    let opts;

    beforeEach(() => {
      client = Client();
    });

    describe('getRepo', () => {
      let repo;

      beforeEach(() => {
        repo = {name: 'foo'};
        sandbox.stub(client.repos, 'getAsync')
          .returns(Promise.resolve(repo));
        opts = {};
      });

      it('should defer to API "repos.get"', () => {
        client.getRepo(opts);
        expect(client.repos.getAsync)
          .to
          .have
          .been
          .calledWithExactly(opts);
      });

      it('should return the return value of API "repos.get"', () => {
        return expect(client.getRepo(opts))
          .to
          .eventually
          .equal(repo);
      });
    });

    describe('reposForOrg', () => {
      let repos;

      beforeEach(() => {
        repos = [
          {
            name: 'foo'
          },
          {
            name: 'bar'
          }
        ];
        sandbox.stub(client, 'getAllPagesAsync')
          .returns(Promise.resolve(repos));
        opts = {};
      });

      it('should defer to API "repos.getForOrgAsync"', () => {
        return client.reposForOrg(opts)
          .then(() => {
            expect(client.getAllPagesAsync)
              .to
              .have
              .been
              .calledWithExactly(client.repos.getForOrg, opts);
          })
      });

      it('should return an array of repo names', () => {
        return expect(client.reposForOrg(opts))
          .to
          .eventually
          .eql(repos);
      });
    });

    describe('contributorsForRepo', () => {
      let contributors;

      beforeEach(() => {
        contributors = [
          {
            login: 'boneskull',
            contributions: 42
          },
          {
            login: 'xdamman',
            contributions: 55
          }
        ];
        sandbox.stub(client, 'getAllPagesAsync')
          .returns(Promise.resolve(contributors));
        opts = {};
      });

      it('should defer to API "repos.getContributorsAsync"', () => {
        return client.contributorsForRepo(opts)
          .then(() => {
            expect(client.getAllPagesAsync)
              .to
              .have
              .been
              .calledWithExactly(client.repos.getContributors, opts);
          })
      });

      it('should return an array of user & contribution data', () => {
        return expect(client.contributorsForRepo(opts))
          .to
          .eventually
          .eql(_.map(value => ({
            user: value.login,
            contributions: value.contributions
          }), contributors));
      });
    });

    describe('membersOfOrg', () => {
      let members;

      beforeEach(() => {
        members = [
          {
            login: 'foo'
          },
          {
            login: 'bar'
          }
        ];
        sandbox.stub(client, 'getAllPagesAsync')
          .returns(Promise.resolve(members.slice(1)));
        opts = {org: 'baz'};
      });

      it('should defer to API "orgs.getPulibcMembers"', () => {
        return client.membersOfOrg(opts)
          .then(() => {
            expect(client.getAllPagesAsync)
              .to
              .have
              .been
              .calledWithExactly(client.orgs.getPublicMembers, opts);
          })
      });

      it('should return an array of public members', () => {
        return expect(client.membersOfOrg(opts))
          .to
          .eventually
          .eql(members.slice(1)
            .map(member => member.login));
      });

      describe('when called with option "private: true"', () => {
        beforeEach(() => {
          client.getAllPagesAsync.restore();
          sandbox.stub(client, 'getAllPagesAsync')
            .returns(Promise.resolve(members));
          opts = {
            org: 'baz',
            private: true
          };
        });

        it('should defer to API "orgs.getMembers"', () => {
          return client.membersOfOrg(opts)
            .then(() => {
              expect(client.getAllPagesAsync)
                .to
                .have
                .been
                .calledWithExactly(client.orgs.getMembers, {org: 'baz'});
            });
        });

        it('should return an array of public members', () => {
          return expect(client.membersOfOrg(opts))
            .to
            .eventually
            .eql(_.map(value => value.login, members));
        });
      });
    });
  });

  afterEach(() => {
    sandbox.restore();
  });
});
