'use strict';

const chai = require('chai');
require('../lib/logger').level = 'silent';

chai.use(require('sinon-chai'));
chai.use(require('chai-as-promised'));

global.sinon = require('sinon');
global.expect = chai.expect;
