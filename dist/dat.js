'use strict';Object.defineProperty(exports, "__esModule", { value: true });exports.







listDatContents = listDatContents;exports.





listDatContents2 = listDatContents2;exports.



importFiles = importFiles;var _fs = require('fs');var _fs2 = _interopRequireDefault(_fs);var _datNode = require('dat-node');var _datNode2 = _interopRequireDefault(_datNode);var _bluebird = require('bluebird');var _bluebird2 = _interopRequireDefault(_bluebird);var _chalk = require('chalk');var _chalk2 = _interopRequireDefault(_chalk);var _paulsDatApi = require('pauls-dat-api');var _paulsDatApi2 = _interopRequireDefault(_paulsDatApi);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}function _asyncToGenerator(fn) {return function () {var gen = fn.apply(this, arguments);return new _bluebird2.default(function (resolve, reject) {function step(key, arg) {try {var info = gen[key](arg);var value = info.value;} catch (error) {reject(error);return;}if (info.done) {resolve(value);} else {return _bluebird2.default.resolve(value).then(function (value) {step("next", value);}, function (err) {step("throw", err);});}}return step("next");});};} // import _ from 'lodash';
// Lists the contents of a dat
function listDatContents(dat) {const archive = dat.archive;const archiveList = _bluebird2.default.promisify(archive.list, { context: archive });return archiveList();}function listDatContents2(dat) {return _paulsDatApi2.default.listFiles(dat.archive, '/');}function importFiles(dw) {if (dw.dat.owner) {return dw.importFiles();
  }
  return _bluebird2.default.resolve(true);
}

/**
   * Adds Library-ish functions to a Dat. Expects the Dat's directory structure to
   * follow Calibre's (Author Name/ Publication Title/ Files)
   */
class DatWrapper {
  constructor(opts) {this.





























































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
      const network = dat.joinNetwork();const stats = dat.trackStats();stats.once('update', () => {console.log(_chalk2.default.gray(_chalk2.default.bold('stats updated')), stats.get());});network.once('connection', () => {console.log('connects via network');console.log(_chalk2.default.gray(_chalk2.default.bold('peers:')), stats.peers);}); // this.start(dat);
    }).then(() => this);} // Just creates a dat object
  create() {const createDatAsync = _bluebird2.default.promisify(_datNode2.default);return createDatAsync(this.directory, this.opts);}importFiles() {const dat = this.dat;if (this.dat.owner) {const importer = dat.importFiles(this.directory, () => console.log(`Finished importing files in ${this.directory}`));importer.on('error', err => console.log(err));}return _bluebird2.default.resolve(false);} // Lists the contents of a dat
  listContents() {const archive = this.dat.archive;const archiveList = _bluebird2.default.promisify(archive.list, { context: archive });return archiveList();} // Download a file or directory
  downloadContent(fn) {var _this = this;return _asyncToGenerator(function* () {console.log(`Downloading: /${fn}`);yield _paulsDatApi2.default.download(_this.dat.archive, fn);})();}}exports.default = DatWrapper;