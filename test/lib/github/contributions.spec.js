'use strict';

const contributionsForOrg = require('../../../lib/github').contributionsForOrg;
const Promise = require('bluebird');

describe('lib:github:contributions', () => {
  let sandbox;
  let client;
  let data;

  beforeEach(() => {
    sandbox = sinon.sandbox.create('lib:github:contributions');
    data = {};
    client = {
      repos: {
        getForOrgAsync: sandbox.stub()
          .returns(Promise.resolve(data))
      }
    };
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
      .equal(data);
  });

  it('should allow a custom "org" property', () => {
    contributionsForOrg(client, {org: 'foo'});
    expect(client.repos.getForOrgAsync)
      .to
      .have
      .been
      .calledWithExactly({org: 'foo'});
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
        .equal(data);
    });

    it('should allow a custom "org" property', () => {
      curried({org: 'foo'});
      expect(client.repos.getForOrgAsync)
        .to
        .have
        .been
        .calledWithExactly({org: 'foo'});
    });

  });

  afterEach(() => {
    sandbox.restore();
  });

});
