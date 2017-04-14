'use strict';Object.defineProperty(exports, "__esModule", { value: true });exports.
























listDatContents = listDatContents;var _fs = require('fs');var _fs2 = _interopRequireDefault(_fs);var _path = require('path');var _path2 = _interopRequireDefault(_path);var _events = require('events');var _events2 = _interopRequireDefault(_events);var _datNode = require('dat-node');var _datNode2 = _interopRequireDefault(_datNode);var _bluebird = require('bluebird');var _bluebird2 = _interopRequireDefault(_bluebird);var _chalk = require('chalk');var _chalk2 = _interopRequireDefault(_chalk);var _paulsDatApi = require('pauls-dat-api');var _paulsDatApi2 = _interopRequireDefault(_paulsDatApi);var _data = require('./utils/data');function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}function _asyncToGenerator(fn) {return function () {var gen = fn.apply(this, arguments);return new _bluebird2.default(function (resolve, reject) {function step(key, arg) {try {var info = gen[key](arg);var value = info.value;} catch (error) {reject(error);return;}if (info.done) {resolve(value);} else {return _bluebird2.default.resolve(value).then(function (value) {step("next", value);}, function (err) {step("throw", err);});}}return step("next");});};} // import _ from 'lodash';
// Uses promises to recursively list a dat's contents using hyperdrive fs-ish functions
// Note that the Promised hyperdrive functions are passed in by the caller.
function lsDat(readdirAsync, statAsync, dir) {return readdirAsync(dir).map(file => {const rFile = _path2.default.join(dir, file);return statAsync(rFile).then(stat => {if (stat.isDirectory()) {return lsDat(readdirAsync, statAsync, rFile);}return rFile;});});} // Lists the contents of a dat
function listDatContents(dat) {const archive = dat.archive; // const archiveList = Promise.promisify(archive.list, { context: archive });
  const readdirAsync = _bluebird2.default.promisify(archive.readdir, { context: archive });const statAsync = _bluebird2.default.promisify(archive.stat, { context: archive });lsDat(readdirAsync, statAsync, '/').
  each(f => console.log(f));
  return [];
  //return archiveList();
}

// export function listDatContents2(dat) {
//   return pda.listFiles(dat.archive, '/');
// }

/**
 * Adds Library-ish functions to a Dat. Expects the Dat's directory structure to
 * follow Calibre's (Author Name/ Publication Title/ Files)
 */
class DatWrapper extends _events2.default {
  constructor(opts) {
    super();this.










































































    exitHandler = options => error => {
      if (options.cleanup) {
        console.log('cleaning up!');
        if (this.dat) this.dat.leave();
      }
      if (error) console.log(error.stack);
      if (options.exit) process.exit();
    };this.directory = opts.directory; // create if it doesn't exist
    if (!_fs2.default.existsSync(opts.directory)) {_fs2.default.mkdirSync(opts.directory);}this.key = opts.key;this.name = opts.name;this.opts = opts;} // Creates a dat and grabs a key
  // Perhaps this gets rewritten to be more like beaker:
  // https://github.com/beakerbrowser/beaker/blob/2c2336430bdb00ea8e47e13fb2e8c8d5b89440ea/app/background-process/networks/dat/dat.js#L231
  run() {return this.create().then(dat => {this.dat = dat;this.key = dat.key.toString('hex'); // const opts = {}; // various network options could go here (https://github.com/datproject/dat-node)
      const network = dat.joinNetwork();const stats = dat.trackStats(); /*
                                                                        stats.once('update', () => {
                                                                          console.log(chalk.gray(chalk.bold('stats updated')), stats.get());
                                                                        });
                                                                        */network.once('connection', () => {console.log('connects via network');console.log(_chalk2.default.gray(_chalk2.default.bold('peers:')), stats.peers);}); // this.start(dat);
    }).then(() => this);} // Just creates a dat object
  create() {const createDatAsync = _bluebird2.default.promisify(_datNode2.default);return createDatAsync(this.directory, this.opts);}importFiles() {return new _bluebird2.default((resolve, reject) => {const dat = this.dat;if (this.dat.writable) {const importer = dat.importFiles({}, () => {console.log(`Finished importing files in ${this.directory}`);resolve(true);});importer.on('error', reject); // Emit event that something has been imported into the dat
        importer.on('put', src => this.emit('import', this, src.name, src.stat));} else {resolve(false);}});} // Lists the contents of the dat
  listContents() {const archive = this.dat.archive;const readdirAsync = _bluebird2.default.promisify(archive.readdir, { context: archive });const statAsync = _bluebird2.default.promisify(archive.stat, { context: archive });return lsDat(readdirAsync, statAsync, '/').then(results => (0, _data.flatten)(results));} // Download a file or directory
  downloadContent(fn = '') {var _this = this;return _asyncToGenerator(function* () {console.log(`Downloading: /${fn}`);yield _paulsDatApi2.default.download(_this.dat.archive, fn);})();}}exports.default = DatWrapper;
//# sourceMappingURL=dat.js.map