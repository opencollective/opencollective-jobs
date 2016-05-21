'use strict';

const contributionsForOrg = require(
  '../../../../lib').github.contributionsForOrg;
const Promise = require('bluebird');

describe('lib:github:contributions', () => {
  let sandbox;
  let client;
  let repos;
  let results;

  beforeEach(() => {
    sandbox = sinon.sandbox.create('lib:github:contributions');
    repos = [
      {name: 'foo'},
      {name: 'bar'}
    ];
    client = {
      repos: {
        getForOrgAsync: sandbox.stub()
          .returns(Promise.resolve(repos)),
        getContributorsAsync: sandbox.stub()
          .returns(Promise.resolve([
            {
              login: 'boneskull',
              contributions: 42
            },
            {
              login: 'xdamman',
              contributions: 55
            }
          ]))
      }
    };
    results = [
      [
        {
          login: 'boneskull',
          repo: 'foo',
          org: 'OpenCollective',
          contributions: 42
        },
        {
          login: 'xdamman',
          repo: 'foo',
          org: 'OpenCollective',
          contributions: 55
        }
      ],
      [
        {
          login: 'boneskull',
          repo: 'bar',
          org: 'OpenCollective',
          contributions: 42
        },
        {
          login: 'xdamman',
          repo: 'bar',
          org: 'OpenCollective',
          contributions: 55
        }
      ]
    ];
  });

  it('should call the "getForOrg" method with the default org', () => {
    contributionsForOrg(client, {});
    expect(client.repos.getForOrgAsync)
      .to
      .have
      .been
      .calledWithExactly(contributionsForOrg.defaultConfig);
  });

  it('should return the value returned by the "getForOrg" method', () => {
    return expect(contributionsForOrg(client, {}))
      .to
      .eventually
      .eql(results);
  });

  it('should allow a custom "org" property', () => {
    contributionsForOrg(client, {org: 'foo'});
    expect(client.repos.getForOrgAsync)
      .to
      .have
      .been
      .calledWithExactly({
        org: 'foo',
        type: 'public'
      });
  });

  describe('when curried', () => {
    let curried;

    beforeEach(() => {
      curried = contributionsForOrg(client);
    });

    it('should call the "getForOrg" method with the default org', () => {
      curried({});
      expect(client.repos.getForOrgAsync)
        .to
        .have
        .been
        .calledWithExactly(contributionsForOrg.defaultConfig);
    });

    it('should return the value returned by the "getForOrg" method', () => {
      return expect(curried({}))
        .to
        .eventually
        .eql(results);
    });

    it('should allow a custom "org" property', () => {
      curried({org: 'foo'});
      expect(client.repos.getForOrgAsync)
        .to
        .have
        .been
        .calledWithExactly({
          org: 'foo',
          type: 'public'
        });
    });

  });

  afterEach(() => {
    sandbox.restore();
  });

});
