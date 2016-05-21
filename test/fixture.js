'use strict';

const chai = require('chai');

chai.use(require('sinon-chai'));
chai.use(require('chai-as-promised'));

global.sinon = require('sinon');
global.expect = chai.expect;
