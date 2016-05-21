'use strict';

const Promise = require('bluebird');

describe('seneca client', () => {
  let seneca;

  before(() => {
    require('../../server');
  });

  beforeEach(() => {
    seneca = Promise.promisifyAll(require('seneca')())
      .client({host: 'localhost'});

    return seneca.readyAsync();
  });

  describe('role: "github"', () => {
    describe('cmd: "contributors"', () => {
      it('should respond to the action', () => {
        return expect(seneca.actAsync({
          role: 'github',
          cmd: 'contributors',
          org: 'OpenCollective'
        }))
          .to
          .eventually
          .be
          .an('array');
      });
    });
  });
});
