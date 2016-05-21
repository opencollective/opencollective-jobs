'use strict';

const Promise = require('bluebird');

if (process.env.NODE_ENV === 'development') {
  require('dotenv')
    .load();
}

const seneca = Promise.promisifyAll(require('seneca')());

seneca.use('postgres-store', process.env.DATABASE_URL)
  .use('./plugins/github')
  .listen();

module.exports = seneca;
