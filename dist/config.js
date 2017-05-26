'use strict';



var _nconf = require('nconf');var _nconf2 = _interopRequireDefault(_nconf);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}

module.exports = _nconf2.default.
overrides({}).
argv().
env({ separator: '__' }).
file('config.json').
defaults({
  dataDir: '_data',
  queueBatchSize: 20 }); /* configger.js
                          * Reads configuration using nconf.
                          * Returns a JavaScript object representing the effective configuration.
                          */
//# sourceMappingURL=config.js.map