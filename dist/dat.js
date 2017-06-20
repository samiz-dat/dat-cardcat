'use strict';Object.defineProperty(exports, "__esModule", { value: true });var _extends = Object.assign || function (target) {for (var i = 1; i < arguments.length; i++) {var source = arguments[i];for (var key in source) {if (Object.prototype.hasOwnProperty.call(source, key)) {target[key] = source[key];}}}return target;};var _fs = require('fs');var _fs2 = _interopRequireDefault(_fs);
var _path = require('path');var _path2 = _interopRequireDefault(_path);
var _events = require('events');var _events2 = _interopRequireDefault(_events);
var _datNode = require('dat-node');var _datNode2 = _interopRequireDefault(_datNode);
var _datCollections = require('dat-collections');var _datCollections2 = _interopRequireDefault(_datCollections);

var _bluebird = require('bluebird');var _bluebird2 = _interopRequireDefault(_bluebird);
var _chalk = require('chalk');var _chalk2 = _interopRequireDefault(_chalk);
var _es = require('pauls-dat-api/es5');var _es2 = _interopRequireDefault(_es);
var _datProtocolBuffers = require('dat-protocol-buffers');var _datProtocolBuffers2 = _interopRequireDefault(_datProtocolBuffers);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}function _asyncToGenerator(fn) {return function () {var gen = fn.apply(this, arguments);return new _bluebird2.default(function (resolve, reject) {function step(key, arg) {try {var info = gen[key](arg);var value = info.value;} catch (error) {reject(error);return;}if (info.done) {resolve(value);} else {return _bluebird2.default.resolve(value).then(function (value) {step("next", value);}, function (err) {step("throw", err);});}}return step("next");});};} // import _ from 'lodash';
// import prettysize from 'prettysize';

// declare common promisified function here
// so they will only be created once.
const createDatAsync = _bluebird2.default.promisify(_datNode2.default);
const renameAsync = _bluebird2.default.promisify(_fs2.default.rename);

function iteratePromised(co, fn) {
  const runner = () => {
    const v = co.next();
    if (v.done) return 'ok';
    return _bluebird2.default.resolve(v.value).then(fn).then(runner);
  };
  return runner();
}

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
























































    connectionEventHandler = () => {
      console.log('connects via network');
      console.log(_chalk2.default.gray(_chalk2.default.bold('peers:')), this.stats.peers);
    };this.

    metadataDownloadEventHandler = (index, data) => {
      this.metadataDownloadCount++;
      if (index === 0) {
        const header = _datProtocolBuffers2.default.Header.decode(data);
        if (header.type !== 'hyperdrive') console.warn('dat header is not a hyperdrive:', header.type);
      } else {
        const block = _datProtocolBuffers2.default.Node.decode(data);
        const progress = this.version > 0 ? this.metadataDownloadCount / (this.version + 1) * 100 : 0;
        this.emit('download metadata', {
          key: this.key,
          version: index,
          type: block.value ? 'put' : 'del',
          progress,
          file: block.path,
          stats: block.value,
          downloadSpeed: this.stats.network.downloadSpeed,
          uploadSpeed: this.stats.network.uploadSpeed,
          peers: this.stats.peers.total || 0 });

        // console.log(`downloaded ${index}/${dat.archive.version + 1}:`, block.path);
        // console.log(`network: ${this.stats.peers.total || 0} peers (${prettysize(this.stats.network.downloadSpeed)}) ${progress.toFixed(2)}% complete`);
      }
    };this.

    metadataSyncEventHandler = () => {
      console.log('metadata synced');
      this.metadataComplete = true;
      this.emit('sync metadata', this.key);
      // @todo: remove this next hack line.
      // But for now we need it because on first load of dat we aren't getting the "loaded" event above
      // this.emit('sync collections', this.key);
    };this.












































































































































    hasFile = file => new _bluebird2.default(r => _fs2.default.access(_path2.default.join(this.directory, file), _fs2.default.F_OK, e => r(!e)));this.directory = opts.directory;this.metadataDownloadCount = 0;this.metadataComplete = false; // create if it doesn't exist
    if (!_fs2.default.existsSync(opts.directory)) {_fs2.default.mkdirSync(opts.directory);}this.key = opts.key;this.name = opts.name;this.stats = false;this.opts = opts; // Don't need the whole history (also we do need files as files)
    this.opts.latest = true; // If we're creating/ hosting a dat, set indexing to true
    // this.opts.indexing = !this.key;
    this.opts.indexing = true;this.importer = false; // Collections
    this.collections = false;} // Just creates a dat object
  create() {return createDatAsync(this.directory, this.opts).then(dat => {this.dat = dat;this.key = dat.key.toString('hex');this.metadataDownloadCount = dat.archive.metadata.downloaded();this.metadataComplete = this.metadataDownloadCount === this.version + 1;console.log('created dat:', this.key);console.log('metadata:', this.metadataDownloadCount, '/', this.version, this.metadataComplete);return this;});} // join network and import files
  run() {this.importFiles();this.collections = new _datCollections2.default(this.dat.archive);this.collections.on('loaded', () => {console.log(`collections data loaded (${this.name})`); // this.emit('sync collections', this);
    });const network = this.dat.joinNetwork();this.stats = this.dat.trackStats();network.once('connection', this.connectionEventHandler); // Watch for metadata syncing
    const metadata = this.dat.archive.metadata;metadata.on('download', this.metadataDownloadEventHandler);metadata.on('sync', this.metadataSyncEventHandler);return this;} // call a function on each downloaded chuck of metadata.
  onEachMetadata(fn, startingFrom) {// returns a promise which will succeed if all are successful or fail and stop iterator.
    return iteratePromised(this.metadataIterator(startingFrom), fn);} // this should iterate over only the downloaded metadata,
  // we can use this to populate database before joining the swarm
  // only importing what has already been downloaded, and then
  // fetch the rest via the 'metadata' downloaded events.
  *metadataIterator(start = 1) {const metadata = this.dat.archive.metadata;let imported = start - 1;const total = metadata.downloaded(); // this can be improved by using the bitfield in hypercore to find next non 0 block, but will do for now.
    for (let i = start; i <= this.version; i++) {if (metadata.has(i)) {yield new _bluebird2.default((resolve, reject) => // fix this to not make functions in a loop.
        metadata.get(i, (error, result) => {if (error) reject(error);else {imported += 1;const progress = total > 0 ? imported / total * 100 : 0;const node = _datProtocolBuffers2.default.Node.decode(result);resolve({ version: i, key: this.key, progress, type: node.value ? 'put' : 'del', file: node.path, stats: node.value });}}));}}}isYours() {return this.dat.writable;} // How many peers for this dat
  get peers() {return this.stats.peers || { total: 0, complete: 0 };}get version() {return this.dat.archive.version;}importFiles(importPath = this.directory) {return new _bluebird2.default((resolve, reject) => {if (this.isYours()) {console.log('Importing files under:', importPath);let putTotal = 0;let putCount = 0;const opts = { watch: true, count: true, dereference: true, indexing: true };this.importer = this.dat.importFiles(importPath, opts, () => {console.log(`Finished importing files in ${importPath}`);this.emit('imported', { key: this.key, path: importPath });resolve(true);});this.importer.on('count', count => {// file count is actually just a put count
          // this could funk out on dat's with lots of dels.
          putTotal = count.files;});this.importer.on('error', reject); // Emit event that something has been imported into the dat
        this.importer.on('put', src => {putCount += 1;const data = { type: 'put', key: this.key, file: src.name.replace(this.directory, ''), stat: src.stat, progress: putTotal > 0 ? putCount / putTotal * 100 : 100, version: this.version // I am not sure if this works as version is not set by mirror-folder
          };this.emit('import', data);});this.importer.on('del', src => {const data = { type: 'del', key: this.key, file: src.name.replace(this.directory, ''), stat: src.stat, progress: putTotal > 0 ? putCount / putTotal * 100 : 100, version: this.version };this.emit('import', data);});} else {resolve(false);}});} // Import a file or directory from another archive
  importFromDat(srcDatWrapper, fileOrDir, overwriteExisting = true) {var _this = this;return _asyncToGenerator(function* () {if (_this.isYours()) {const dstPath = _path2.default.join(_this.directory, fileOrDir);return _es2.default.exportArchiveToFilesystem({ srcArchive: srcDatWrapper.dat.archive, dstPath, srcPath: fileOrDir, overwriteExisting }); // .then(() => this.importFiles());
      }console.log('Warning: You tried to write to a Dat that is not yours. Nothing has been written.'); // Fallback
      return _bluebird2.default.resolve(false);})();} // Lists the contents of the dat
  listContents(below = '/') {return _es2.default.readdir(this.dat.archive, below, { recursive: true });} // Download a file or directory
  downloadContent(fn = '') {const filename = `/${fn}/`;console.log(`Downloading: ${filename}`);console.log(this.stats.peers);return _es2.default.download(this.dat.archive, filename);} // Has the file been downloaded?
  // Rename
  rename(dir, name) {return renameAsync(this.directory, dir).then(() => {this.directory = dir;this.name = name;});} // Initialize the collections
  listFlattenedCollections() {if (this.collections) {return this.collections.flatten();}return _bluebird2.default.reject();} // Write a manifest file
  // @todo: fix me! why do i write empty manifests?
  writeManifest(opts = {}) {var _this2 = this;return _asyncToGenerator(function* () {const manifest = _extends({ url: `dat://${_this2.key}`, title: _this2.name }, opts);yield _es2.default.writeManifest(_this2.dat.archive, manifest);return _this2;})();}readManifest() {return _es2.default.readManifest(this.dat.archive);
  }

  updateManifest(manifest) {
    return _es2.default.updateManifest(this.dat.archive, manifest);
  }

  close() {
    return new _bluebird2.default((resolve, reject) => this.dat.close(err => {
      if (err) reject(err);else
      resolve();
    }));
  }}exports.default = DatWrapper;
//# sourceMappingURL=dat.js.map