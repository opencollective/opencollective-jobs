'use strict';

const createClient = require('../../../lib/github').createClient;

describe('lib:github:createClient', () => {
  it('should return a GitHub API client', () => {
    expect(createClient())
      .to
      .have
      .property('repos')
      .that
      .is
      .an('object');
  });

  it('should be promisified', () => {
    expect(createClient())
      .to
      .have
      .deep
      .property('repos.getForOrgAsync')
      .that
      .is
      .a('function');
  });

  describe('when no config is specified', () => {
    describe('the resulting GitHub API client', () => {
      let client;

      beforeEach(() => {
        client = createClient();
      });

      it('should use the default config', () => {
        expect(client.config)
          .to
          .eql(createClient.defaultConfig);
      });
    });
  });

  describe('when a config is specified', () => {
    let config;

    describe('and the config contains a "version" property', () => {
      beforeEach(() => {
        config = {
          version: '2.0.0',
          timeout: 10000
        };
      });

      describe('the resulting GitHub API client', () => {
        let client;

        beforeEach(() => {
          client = createClient(config);
        });

        it('should not reflect the "version" property"', () => {
          expect(client.config)
            .to
            .have
            .property('version', '3.0.0');
        });

        it('should reflect the other override(s)', () => {
          expect(client.config)
            .to
            .have
            .property('timeout', 10000);
        });
      });
    });
    describe('and the config does not contain a "version" property', () => {
      beforeEach(() => {
        config = {timeout: 10000};
      });

      describe('the resulting GitHub API client', () => {
        let client;

        beforeEach(() => {
          client = createClient(config);
        });

        it('should reflect the override(s)', () => {
          expect(client.config)
            .to
            .have
            .property('timeout', 10000);
        });
      });
    });
  });
});
