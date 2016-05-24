'use strict';

const Promise = require('bluebird');

describe.skip('seneca client', () => {
  let seneca;

  before(() => {
    require('dotenv')
      .load();
    require('../../server');
  });

  beforeEach(() => {
    seneca = Promise.promisifyAll(require('seneca')({timeout: 999999999}))
      .client({host: 'localhost'});

    return seneca.readyAsync();
  });

  describe('role: "github"', () => {
    describe('cmd: "contributions"', () => {
      it('should respond to the action', () => {
        return expect(seneca.actAsync({
          role: 'github',
          cmd: 'contributions',
          org: 'OpenCollective',

        }))
          .to
          .eventually
          .be
          .an('array');
      });
    });

    describe('cmd: "contributions2"', () => {
      it('should respond to the action', () => {
        return expect(seneca.actAsync({
          role: 'github',
          cmd: 'contributions',
          org: 'digsjs',
          external: true,
          timeout$: 999999999
        }))
          .to
          .eventually
          .be
          .an('array');
      });
    });

  });
});
