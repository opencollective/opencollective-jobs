'use strict';

module.exports = function wallabyConfig () {
  return {
    files: [
      'package.json',
      'lib/**/*.js',
      {
        pattern: 'test/fixture.js',
        instrument: false
      }
    ],

    tests: [
      'test/unit/**/*.spec.js'
    ],

    testFramework: 'mocha',

    env: {
      type: 'node',
      runner: 'node',
      params: {
        env: 'NODE_ENV=development'
      }
    },

    bootstrap: function bootstrap (wallaby) {
      const path = require('path');
      require(path.join(wallaby.projectCacheDir, 'test', 'fixture'));
    }
  };
};
