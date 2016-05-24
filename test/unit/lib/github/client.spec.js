'use strict';

const createClient = require('../../../../lib').github.createClient;
const GitHub = require('github4');

describe('lib:github:createClient', () => {
  let sandbox;

  before(() => {
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
    sandbox = sinon.sandbox.create('lib:github:createClient');
    sandbox.stub(GitHub.prototype, 'authenticate');

    process.env.GITHUB_CLIENT_ID = 'foo';
    process.env.GITHUB_CLIENT_SECRET = 'bar';
  });

  it('should return a client object', () => {
    expect(createClient())
      .to
      .have
      .property('contributions')
      .that
      .is
      .a('function');
  });

  it('should authenticate', () => {
    createClient();
    expect(GitHub.prototype.authenticate)
      .to
      .have
      .been
      .calledWithExactly({
        type: 'oauth',
        key: process.env.GITHUB_CLIENT_ID,
        secret: process.env.GITHUB_CLIENT_SECRET
      });
  });

  describe('when no config is specified', () => {
    describe('the resulting GitHub API client', () => {
      let client;

      beforeEach(() => {
        client = createClient();
      });

      it('should use the default config', () => {
        expect(client.client.config)
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
          expect(client)
            .to
            .have
            .deep
            .property('client.config.version', '3.0.0');
        });

        it('should reflect the other override(s)', () => {
          expect(client)
            .to
            .have
            .deep
            .property('client.config.timeout', 10000);
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
          expect(client)
            .to
            .have
            .deep
            .property('client.config.timeout', 10000);
        });
      });
    });
  });

  afterEach(() => {
    sandbox.restore();
  });
});
