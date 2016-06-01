'use strict';

const log = require('npmlog');
const tty = require('tty');

log.addLevel('debug', -Infinity, {fg: 'grey'});
log.addLevel('verbose', 1000, {fg: 'green'});
log.addLevel('info', 2000, {fg: 'blue'});
log.addLevel('warn', 4000, {fg: 'yellow'});
log.addLevel('error', 5000, {fg: 'red'});
log.prefixStyle = {
  fg: 'grey',
  underline: true
};

module.exports = log;
