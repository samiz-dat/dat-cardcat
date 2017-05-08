'use strict';Object.defineProperty(exports, "__esModule", { value: true });var _fs = require('fs');var _fs2 = _interopRequireDefault(_fs);
var _path = require('path');var _path2 = _interopRequireDefault(_path);
var _events = require('events');var _events2 = _interopRequireDefault(_events);
var _datNode = require('dat-node');var _datNode2 = _interopRequireDefault(_datNode);

var _bluebird = require('bluebird');var _bluebird2 = _interopRequireDefault(_bluebird);
var _chalk = require('chalk');var _chalk2 = _interopRequireDefault(_chalk);
var _paulsDatApi = require('pauls-dat-api');var _paulsDatApi2 = _interopRequireDefault(_paulsDatApi);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}function _asyncToGenerator(fn) {return function () {var gen = fn.apply(this, arguments);return new _bluebird2.default(function (resolve, reject) {function step(key, arg) {try {var info = gen[key](arg);var value = info.value;} catch (error) {reject(error);return;}if (info.done) {resolve(value);} else {return _bluebird2.default.resolve(value).then(function (value) {step("next", value);}, function (err) {step("throw", err);});}}return step("next");});};} // import _ from 'lodash';

// import { lsFilesPromised } from './utils/filesystem';

// fork() - download a dat and fork it (thru dat.json)
// list() - lists files
// download() - downloads some files
// read/writeManifest()
// health/ stats

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
        if (this.importer) this.importer.destroy();
      }
      if (error) console.log(error.stack);
      if (options.exit) process.exit();
    };this.directory = opts.directory; // create if it doesn't exist
    if (!_fs2.default.existsSync(opts.directory)) {_fs2.default.mkdirSync(opts.directory);}this.key = opts.key;this.name = opts.name;this.stats = false;this.opts = opts; // Don't need the whole history (also we do need files as files)
    this.opts.latest = true; // If we're creating/ hosting a dat, set indexing to true
    // this.opts.indexing = !this.key;
    this.opts.indexing = true;this.importer = false;} // Creates a dat and grabs a key
  // Perhaps this gets rewritten to be more like beaker:
  // https://github.com/beakerbrowser/beaker/blob/2c2336430bdb00ea8e47e13fb2e8c8d5b89440ea/app/background-process/networks/dat/dat.js#L231
  run() {return this.create().then(dat => {this.dat = dat;this.key = dat.key.toString('hex'); // const opts = {}; // various network options could go here (https://github.com/datproject/dat-node)
      const network = dat.joinNetwork();this.stats = dat.trackStats();this.importFiles(); /*
                                                                                          stats.once('update', () => {
                                                                                            console.log(chalk.gray(chalk.bold('stats updated')), stats.get());
                                                                                          });
                                                                                          */network.once('connection', () => {console.log('connects via network');console.log(_chalk2.default.gray(_chalk2.default.bold('peers:')), this.stats.peers);}); // this.start(dat);
      // Watch for metadata syncing
      dat.archive.metadata.on('sync', () => {console.log('metadata synced');this.emit('sync metadata', this);});}) // .then(() => this.importFiles())
    .then(() => this);} // Just creates a dat object
  create() {const createDatAsync = _bluebird2.default.promisify(_datNode2.default);return createDatAsync(this.directory, this.opts);} // How many peers for this dat
  get peers() {return this.stats.peers || 0;}importFiles(importPath = this.directory) {return new _bluebird2.default((resolve, reject) => {const dat = this.dat;if (this.dat.writable) {console.log('Importing files under:', importPath);const opts = { watch: true, dereference: true, indexing: true };this.importer = dat.importFiles(importPath, opts, () => {console.log(`Finished importing files in ${importPath}`);resolve(true);});this.importer.on('error', reject); // Emit event that something has been imported into the dat
        this.importer.on('put', src => this.emit('import', this, src.name.replace(this.directory, ''), src.stat));} else {resolve(false);}});} // Import a file o directory from another archive
  importFromDat(srcDatWrapper, fileOrDir, overwriteExisting = true) {var _this = this;return _asyncToGenerator(function* () {if (_this.dat.writable) {const dstPath = _path2.default.join(_this.directory, fileOrDir);return _paulsDatApi2.default.exportArchiveToFilesystem({ srcArchive: srcDatWrapper.dat.archive, dstPath, srcPath: fileOrDir, overwriteExisting }); // .then(() => this.importFiles());
      } // Fallback
      return _bluebird2.default.resolve(false);})();} // Lists the contents of the dat
  listContents(below = '/') {return _paulsDatApi2.default.readdir(this.dat.archive, below, { recursive: true });} // Download a file or directory
  downloadContent(fn = '') {const fn2 = `/${fn}/`;console.log(`Downloading: ${fn2}`);console.log(this.stats.peers);return _paulsDatApi2.default.download(this.dat.archive, fn2);} // Has the file been downloaded?
  hasFile(file) {return _fs2.default.statAsync(_path2.default.join(this.directory, file)).catch(e => {});} // Rename
  rename(dir, name) {const renameAsync = _bluebird2.default.promisify(_fs2.default.rename);return renameAsync(this.directory, dir).then(() => {this.directory = dir;this.name = name;});}}exports.default = DatWrapper;
//# sourceMappingURL=dat.js.map