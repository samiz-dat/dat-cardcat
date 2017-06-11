'use strict';Object.defineProperty(exports, "__esModule", { value: true });var _extends = Object.assign || function (target) {for (var i = 1; i < arguments.length; i++) {var source = arguments[i];for (var key in source) {if (Object.prototype.hasOwnProperty.call(source, key)) {target[key] = source[key];}}}return target;};var _fs = require('fs');var _fs2 = _interopRequireDefault(_fs);
var _path = require('path');var _path2 = _interopRequireDefault(_path);
var _events = require('events');var _events2 = _interopRequireDefault(_events);
var _datNode = require('dat-node');var _datNode2 = _interopRequireDefault(_datNode);


var _bluebird = require('bluebird');var _bluebird2 = _interopRequireDefault(_bluebird);
var _chalk = require('chalk');var _chalk2 = _interopRequireDefault(_chalk);
var _es = require('pauls-dat-api/es5');var _es2 = _interopRequireDefault(_es);
var _folderWalker = require('folder-walker');var _folderWalker2 = _interopRequireDefault(_folderWalker);
var _through = require('through2');var _through2 = _interopRequireDefault(_through);
var _pumpify = require('pumpify');var _pumpify2 = _interopRequireDefault(_pumpify);
var _node = require('dat-protocol-buffers/messages/node');var _node2 = _interopRequireDefault(_node);
var _prettysize = require('prettysize');var _prettysize2 = _interopRequireDefault(_prettysize);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}function _asyncToGenerator(fn) {return function () {var gen = fn.apply(this, arguments);return new _bluebird2.default(function (resolve, reject) {function step(key, arg) {try {var info = gen[key](arg);var value = info.value;} catch (error) {reject(error);return;}if (info.done) {resolve(value);} else {return _bluebird2.default.resolve(value).then(function (value) {step("next", value);}, function (err) {step("throw", err);});}}return step("next");});};} // import Collections from 'dat-collections';
// import _ from 'lodash';
// declare common promisified function here
// so they will only be created once.
const createDatAsync = _bluebird2.default.promisify(_datNode2.default);

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



































































































































































































    hasFile = file => new _bluebird2.default(r => _fs2.default.access(_path2.default.join(this.directory, file), _fs2.default.F_OK, e => r(!e)));this.











































    exitHandler = options => error => {
      if (options.cleanup) {
        console.log('cleaning up!');
        if (this.dat) this.dat.leave();
        if (this.importer) this.importer.destroy();
      }
      if (error) console.log(error.stack);
      if (options.exit) process.exit();
    };this.directory = opts.directory;this.metadataDownloadCount = 0;this.metadataComplete = false; // create if it doesn't exist
    if (!_fs2.default.existsSync(opts.directory)) {_fs2.default.mkdirSync(opts.directory);}this.key = opts.key;this.name = opts.name;this.stats = false;this.opts = opts; // Don't need the whole history (also we do need files as files)
    this.opts.latest = true; // If we're creating/ hosting a dat, set indexing to true
    // this.opts.indexing = !this.key;
    this.opts.indexing = true;this.importer = false; // Collections
    this.collections = false;} // Creates a dat and grabs a key
  // Perhaps this gets rewritten to be more like beaker:
  // https://github.com/beakerbrowser/beaker/blob/2c2336430bdb00ea8e47e13fb2e8c8d5b89440ea/app/background-process/networks/dat/dat.js#L231
  run() {return this.create().then(dat => {this.dat = dat;this.key = dat.key.toString('hex'); // const opts = {}; // various network options could go here (https://github.com/datproject/dat-node)
      this.metadataDownloadCount = dat.archive.metadata.downloaded();this.metadataComplete = this.metadataDownloadCount === dat.archive.version + 1;const network = dat.joinNetwork();this.stats = dat.trackStats();this.importFiles(); /*
                                                                                                                                                                                                                                        stats.once('update', () => {
                                                                                                                                                                                                                                          console.log(chalk.gray(chalk.bold('stats updated')), stats.get());
                                                                                                                                                                                                                                        });
                                                                                                                                                                                                                                        */network.once('connection', () => {console.log('connects via network');console.log(_chalk2.default.gray(_chalk2.default.bold('peers:')), this.stats.peers);}); // temporaryly disable collections
      // this.collections = new Collections(dat.archive);
      // this.collections.on('loaded', () => {
      //   console.log(`collections data loaded (${this.name})`);
      //   // this.emit('sync collections', this);
      // });
      // this.start(dat);
      // Watch for metadata syncing
      dat.archive.metadata.on('download', (index, data) => {this.metadataDownloadCount++;if (index === 0) {// should probably do some check here to make sure the data is a hyperdrive instance
          // const header = messages.Header.decode(data);
          // console.log(header);
        } else {const block = _node2.default.Node.decode(data);const progress = dat.archive.version > 0 ? this.metadataDownloadCount / (dat.archive.version + 1) * 100 : 0; // if (block.children) {
          //   console.log('has children');
          // }
          this.emit('download metadata', { progress, filename: block.path, stats: block.value, downloadSpeed: this.stats.network.downloadSpeed, uploadSpeed: this.stats.network.uploadSpeed, peers: this.stats.peers.total || 0 }); // console.log(`downloaded ${index}/${dat.archive.version + 1}:`, block.path);
          // console.log(`network: ${this.stats.peers.total || 0} peers (${prettysize(this.stats.network.downloadSpeed)}) ${progress.toFixed(2)}% complete`);
        }});dat.archive.metadata.on('sync', () => {console.log('metadata synced');this.metadataComplete = true;this.emit('sync metadata', this); // @todo: remove this next hack line.
        // But for now we need it because on first load of dat we aren't getting the "loaded" event above
        this.emit('sync collections', this);});} // .then(() => this.importFiles())
    ).then(() => this);} // Just creates a dat object
  create() {return createDatAsync(this.directory, this.opts);} // How many peers for this dat
  get peers() {return this.stats.peers || { total: 0, complete: 0 };}get version() {return this.dat.archive.version;}importFiles(importPath = this.directory) {return new _bluebird2.default((resolve, reject) => {const dat = this.dat;if (this.dat.writable) {console.log('Importing files under:', importPath);const opts = { watch: true, dereference: true, indexing: true };this.importer = dat.importFiles(importPath, opts, () => {console.log(`Finished importing files in ${importPath}`);resolve(true);});this.importer.on('error', reject); // Emit event that something has been imported into the dat
        this.importer.on('put', src => this.emit('import', this, src.name.replace(this.directory, ''), src.stat));} else {resolve(false);}});} // Import a file or directory from another archive
  importFromDat(srcDatWrapper, fileOrDir, overwriteExisting = true) {var _this = this;return _asyncToGenerator(function* () {if (_this.dat.writable) {const dstPath = _path2.default.join(_this.directory, fileOrDir);return _es2.default.exportArchiveToFilesystem({ srcArchive: srcDatWrapper.dat.archive, dstPath, srcPath: fileOrDir, overwriteExisting }); // .then(() => this.importFiles());
      }console.log('Warning: You tried to write to a Dat that is not yours. Nothing has been written.'); // Fallback
      return _bluebird2.default.resolve(false);})();} // Lists the contents of the dat
  listContents(below = '/') {return _es2.default.readdir(this.dat.archive, below, { recursive: true });} // Replays the history of this dat since a particular version.
  replayHistory(sinceVersion = 0) {const stream = this.dat.archive.history({ start: sinceVersion });stream.on('data', data => this.emit('history data', this, data));stream.on('end', () => this.emit('history end'));return _bluebird2.default.resolve(true);} // Pump the listed contents of the dat into some destination: func(datWriter, filePath)
  pumpContents(below = '/') {const stream = (0, _folderWalker2.default)(below, { fs: this.dat.archive });stream.on('data', data => this.emit('listing data', this, data.filepath, data)); // stream.on('data', data => func.call(context, this, data.filepath));
    stream.on('end', () => this.emit('listing end', this)); /*
                                                            const handleEntry = through.ctor({ objectMode: true }, (data, enc, next) => {
                                                              func.call(context, this, data.filepath);
                                                              next();
                                                            });
                                                            // walker stream has an 'end' event
                                                            const pump = pumpify.obj(
                                                              walker(below, { fs: this.dat.archive }),
                                                              handleEntry(),
                                                            );
                                                            pump.on('end', () => {
                                                              console.log('DONE PUMPING!');
                                                            });
                                                            pump.on('error', () => {
                                                              console.log('ERROR!!!!!!');
                                                            });
                                                            */return _bluebird2.default.resolve(true);} // Download a file or directory
  downloadContent(fn = '') {const filename = `/${fn}/`;console.log(`Downloading: ${filename}`);console.log(this.stats.peers);return _es2.default.download(this.dat.archive, filename);} // Has the file been downloaded?
  // Rename
  rename(dir, name) {const renameAsync = _bluebird2.default.promisify(_fs2.default.rename);return renameAsync(this.directory, dir).then(() => {this.directory = dir;this.name = name;});} // Initialize the collections
  listFlattenedCollections() {return this.collections.flatten();} // Write a manifest file
  // @todo: fix me! why do i write empty manifests?
  writeManifest(opts = {}) {var _this2 = this;return _asyncToGenerator(function* () {const manifest = _extends({ url: `dat://${_this2.key}`, title: _this2.name }, opts);yield _es2.default.writeManifest(_this2.dat.archive, manifest);return _this2;})();}readManifest() {return _es2.default.readManifest(this.dat.archive);}updateManifest(manifest) {return _es2.default.updateManifest(this.dat.archive, manifest);}close() {return new _bluebird2.default((resolve, reject) => this.dat.close(err => {if (err) reject(err);else resolve();}));}}exports.default = DatWrapper;