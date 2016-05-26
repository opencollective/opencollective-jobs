'use strict';

const Client = require('../../../../lib').github;
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

    describe('logging', () => {
      it('should init a logging context', () => {
        expect(client.loggingContext)
          .to
          .eql([require('npmlog')]);
      });

      it('should expose a property descriptor "log"', () => {
        expect(client)
          .to
          .have
          .ownPropertyDescriptor('log');
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

  describe('property descriptor', () => {
    let client;

    beforeEach(() => {
      client = Client();
    });

    describe('log', () => {
      it('should not have a setter', () => {
        expect(() => {
          client.log = 'foo';
        })
          .to
          .throw(Error);
      });

      it('should return the last element in loggingContext', () => {
        expect(client.log)
          .to
          .equal(_.last(client.loggingContext));
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
        sandbox.stub(client.repos, 'getForOrgAsync')
          .returns(Promise.resolve(repos));
        opts = {};
      });

      it('should defer to API "repos.getForOrgAsync"', () => {
        client.reposForOrg(opts);
        expect(client.repos.getForOrgAsync)
          .to
          .have
          .been
          .calledWithExactly(opts);
      });

      it('should return an array of repo names', () => {
        return expect(client.reposForOrg(opts))
          .to
          .eventually
          .eql(_.map('name', repos));
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
        sandbox.stub(client.repos, 'getContributorsAsync')
          .returns(Promise.resolve(contributors));
        opts = {};
      });

      it('should defer to API "repos.getContributorsAsync"', () => {
        client.contributorsForRepo(opts);
        expect(client.repos.getContributorsAsync)
          .to
          .have
          .been
          .calledWithExactly(opts);
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
        sandbox.stub(client.orgs, 'getMembersAsync')
          .returns(Promise.resolve(members));
        sandbox.stub(client.orgs, 'getPublicMembersAsync')
          .returns(Promise.resolve(members.slice(1)));
        opts = {org: 'baz'};
      });

      it('should defer to API "orgs.getPublicMembersAsync"', () => {
        client.membersOfOrg(opts);
        expect(client.orgs.getPublicMembersAsync)
          .to
          .have
          .been
          .calledWithExactly(opts);
      });

      it('should return an array of public members', () => {
        return expect(client.membersOfOrg(opts))
          .to
          .eventually
          .eql(_.map(value => ({user: value.login}), members.slice(1)));
      });

      describe('when called with option "private: true"', () => {
        beforeEach(() => {
          opts = {org: 'baz', private: true};
        });

        it('should defer to API "orgs.getPublicMembersAsync"', () => {
          client.membersOfOrg(opts);
          expect(client.orgs.getMembersAsync)
            .to
            .have
            .been
            .calledWithExactly({org: 'baz'});
        });

        it('should return an array of public members', () => {
          return expect(client.membersOfOrg(opts))
            .to
            .eventually
            .eql(_.map(value => ({user: value.login}), members));
        });
      });
    });
  });

  afterEach(() => {
    sandbox.restore();
  });
});
