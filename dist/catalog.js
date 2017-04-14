'use strict';Object.defineProperty(exports, "__esModule", { value: true });exports.Catalog = undefined;var _extends = Object.assign || function (target) {for (var i = 1; i < arguments.length; i++) {var source = arguments[i];for (var key in source) {if (Object.prototype.hasOwnProperty.call(source, key)) {target[key] = source[key];}}}return target;};







// this function can be made a method of dat class too.

// import { opf2js } from './opf';
exports.
























































































































































































































































createCatalog = createCatalog;var _path = require('path');var _path2 = _interopRequireDefault(_path);var _fs = require('fs');var _fs2 = _interopRequireDefault(_fs);var _bluebird = require('bluebird');var _bluebird2 = _interopRequireDefault(_bluebird);var _chalk = require('chalk');var _chalk2 = _interopRequireDefault(_chalk);var _lodash = require('lodash');var _lodash2 = _interopRequireDefault(_lodash);var _rimraf = require('rimraf');var _rimraf2 = _interopRequireDefault(_rimraf);var _config = require('./config');var _config2 = _interopRequireDefault(_config);var _dat = require('./dat');var _dat2 = _interopRequireDefault(_dat);var _db = require('./db');var _db2 = _interopRequireDefault(_db);var _filesystem = require('./utils/filesystem');var _importers = require('./utils/importers');var _importers2 = _interopRequireDefault(_importers);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };} // @todo: this.db.close(); should be called on shutdown
// Class definition
class Catalog {constructor(baseDir) {this.getDats = () => this.db.getDats();this.getAuthors = (...args) => this.db.getAuthors(...args);this.getAuthorLetters = (...args) => this.db.getAuthorLetters(...args);this.getTitlesWith = (...args) => this.db.getTitlesWith(...args);this.search = (...args) => this.db.search(...args);this.pathIsDownloaded = (dat, filePath) => _fs2.default.existsSync(_path2.default.join(dat.directory, filePath));this.baseDir = baseDir;this.dats = [];this.db = new _db2.default(_path2.default.format({ dir: this.baseDir, base: 'catalog.db' })); // If you ever need to see what queries are being run uncomment the following.
    // this.db.on('query', queryData => console.log(queryData));
    this.isReady = false;}initDatabase() {return this.db.init();} // Every imported and added dat gets added to the `dats` table of the database. If
  // the directories are deleted then these db entries are useless and should be removed.
  // This will simply confirm that every dat directory in the db still exists.
  cleanupDatsRegistry() {console.log('Cleaning up the dats registry');return this.getDats().map(dat => dat).filter(dat => (0, _filesystem.notADir)(dat.dir)).each(dat => {console.log(`Removing: ${_chalk2.default.bold(dat.dir)} (directory does not exist)`);return this.removeDat(dat.dat, false);}).then(() => this);} // Look inside the base directory for any directories that seem to be dats
  discoverDats() {return (0, _filesystem.getDirectories)(this.baseDir).map(name => {console.log(`Attempting to load dir: ${_chalk2.default.bold(name)} as a dat`);const opts = { name, createIfMissing: false, sparse: true };return this.importDat(opts);}).then(() => this.cleanupDatsRegistry()).then(() => this.importDatsFromDB()).then(() => this);} // Imports dats listed in the dats table of the database
  importDatsFromDB() {return this.getDats().map(dat => dat).filter(dat => (0, _filesystem.notADir)(dat.dir)) // directory exists
    .filter(dat => !dat.dir.startsWith(this.baseDir)) // not in data directory
    .filter(dat => !(dat.key in this.dats.keys())) // not in registry
    .each(dat => this.importDir(dat.dir, dat.name)).then(() => console.log('Imported dats from DB'));} // Imports a directory on the local filesystem as a dat.
  // This should not be called on any directories inside `dataDir`, which are loaded differently
  importDir(directory, name = false) {console.log(`Attempting to import local directory: ${directory}`);const opts = { directory, name: name || directory.split(_path2.default.sep).slice(-1)[0] };return this.importDat(opts);} // Importing a remote dat by its key
  importRemoteDat(key, name = false) {console.log(`Attempting to import remote dat: ${key}`);const opts = { key, name: name || key, sparse: true };return this.importDat(opts);} // Does the work of importing a functional dat into the catalog
  importDat(opts) {if ('key' in opts && opts.key in this.dats) {// The dat is already loaded, we shouldn't reimport it
      console.log(`You are trying to import a dat that is already loaded: ${opts.key}`);return _bluebird2.default.resolve(false);}if (!opts.directory) {opts.directory = _path2.default.format({ dir: this.baseDir, base: opts.name ? opts.name : opts.key });}const newDat = new _dat2.default(opts, this); // listen to events emitted from this dat wrapper
    newDat.on('import', (...args) => this.handleDatImportEvent(...args)); // dw.on('download', (...args) => this.handleDatDownloadEvent(...args));
    return newDat.run().then(() => this.registerDat(newDat)).then(() => newDat.importFiles()).then(() => newDat.listContents()).each(file => this.importDatFile(newDat, file)).catch(err => {console.log(`* Something went wrong when importing ${opts.directory}`);console.log(err);});} // Registers dat in catalog array and in database (@todo)
  registerDat(dw) {const datkey = dw.dat.key.toString('hex');console.log(`Adding dat (${datkey}) to the catalog.`);return this.db.removeDat(datkey).then(() => this.db.clearTexts(datkey)).then(() => this.db.addDat(datkey, dw.name, dw.directory)).finally(() => {this.dats[datkey] = dw;}).catch(e => console.log(e));} // Rename a dat - updates database and directory
  renameDat(key, name) {const renameAsync = _bluebird2.default.promisify(_fs2.default.rename);const newPath = _path2.default.format({ dir: this.baseDir, base: name });return this.db.pathToDat(key).then(p => renameAsync(p.dir, newPath)).then(() => this.db.updateDat(key, name, newPath));} // Delete a dat from catalog. Only deletes directory if it's in the baseDir
  removeDat(key, deleteDir = true) {if (deleteDir) {return this.db.pathToDat(key).then(p => {if (p.dir.startsWith(this.baseDir)) {const rimrafAsync = _bluebird2.default.promisify(_rimraf2.default);return this.db.removeDat(key).then(() => this.db.clearTexts(key)).then(() => rimrafAsync(p.dir));}return _bluebird2.default.resolve(false);});}return this.db.removeDat(key).then(() => this.db.clearTexts(key));} // Adds an entry from a Dat
  importDatFile(dat, file, format = 'calibre') {const importedData = (0, _importers2.default)(file, format);if (importedData) {const downloaded = this.pathIsDownloaded(dat, file);const downloadedStr = downloaded ? '[*]' : '[ ]';console.log(_chalk2.default.bold('adding:'), downloadedStr, file);return this.db.addText({ dat: dat.key, author: importedData.author, author_sort: importedData.authorSort, title: importedData.title, file: importedData.file, downloaded });}return _bluebird2.default.resolve(false);} // Now, database functions are passed on from this.db
  // It kind of amounts to a data API
  // Public call for syncing files within a dat
  // opts can include {dat:, author: , title:, file: }
  checkout(opts) {if (!opts) {console.warn('attempted to checkout without opts.');return _bluebird2.default.reject();}if (opts.dat) {if (typeof opts.dat === 'string') {return this.download(opts.dat, opts).then(() => this.scanForDownloads(opts, opts.dat));} else if (Array.isArray(opts.dat)) {return _bluebird2.default.map(opts.dat, dat => this.checkout(_extends({}, opts, { dat })));}console.warn('dat option passed to check is not an array or a string');return _bluebird2.default.reject();} // With no dat provided, we must query for it
    return this.db.getDatsWith(opts).map(row => row.dat).each(dat => this.download(dat, opts)) // .each() passes through the original array
    .then(dats => this.scanForDownloads(opts, _lodash2.default.uniq(dats)));} // Checks whether a group of catalogue items have been downloaded
  // and if so, then updates the downloaded column in the texts table
  scanForDownloads(opts, dat) {return this.db.getItemsWith(opts, dat).then(rows => rows.filter(doc => this.itemIsDownloaded(doc))).each(row => this.setDownloaded(row.dat, row.author, row.title, row.file));}download(dat, opts) {if (opts.author && opts.title && opts.file) {console.log(`checking out ${opts.author}/${opts.title}/${opts.file} from ${dat}`);return this.dats[dat].downloadContent(_path2.default.join(opts.author, opts.title, opts.file));} else if (opts.author && opts.title) {console.log(`checking out ${opts.author}/${opts.title} from ${dat}`);return this.dats[dat].downloadContent(_path2.default.join(opts.author, opts.title));} else if (opts.author) {console.log(`checking out ${opts.author} from ${dat}`);return this.dats[dat].downloadContent(_path2.default.join(opts.author));} // If no opts are provided, but a dat is then download the whole dat
    console.log(`checking out everything from ${opts.dat}`);return this.dats[dat].downloadContent();} // Synchronous
  // Given a row from the texts table, check if it has been downloaded
  itemIsDownloaded(dbRow) {return this.pathIsDownloaded(this.dats[dbRow.dat], _path2.default.join(dbRow.author, dbRow.title, dbRow.file));} // Event listening
  //
  // When a dat imports a file
  handleDatImportEvent(dw, path, stat) {// console.log('Importing: ', path);
  }}exports.Catalog = Catalog;function createCatalog(dataDir) {// Directory to store all the data in
  let dataDirFinal = _path2.default.join(process.cwd(), _config2.default.get('dataDir'));dataDirFinal = dataDir || dataDirFinal; // Create data directory if it doesn't exist yet
  if (!_fs2.default.existsSync(dataDirFinal)) {_fs2.default.mkdirSync(dataDirFinal);}const catalog = new Catalog(dataDirFinal);return catalog.initDatabase().then(() => catalog);}exports.default = Catalog;
//# sourceMappingURL=catalog.js.map