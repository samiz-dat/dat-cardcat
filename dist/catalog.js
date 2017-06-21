'use strict';Object.defineProperty(exports, "__esModule", { value: true });exports.Catalog = undefined;var _extends = Object.assign || function (target) {for (var i = 1; i < arguments.length; i++) {var source = arguments[i];for (var key in source) {if (Object.prototype.hasOwnProperty.call(source, key)) {target[key] = source[key];}}}return target;};exports.






























































































































































































































































































































































































































createCatalog = createCatalog;var _events = require('events');var _events2 = _interopRequireDefault(_events);var _path = require('path');var _path2 = _interopRequireDefault(_path);var _fs = require('fs');var _fs2 = _interopRequireDefault(_fs);var _bluebird = require('bluebird');var _bluebird2 = _interopRequireDefault(_bluebird);var _chalk = require('chalk');var _chalk2 = _interopRequireDefault(_chalk);var _lodash = require('lodash');var _lodash2 = _interopRequireDefault(_lodash);var _rimraf = require('rimraf');var _rimraf2 = _interopRequireDefault(_rimraf);var _config = require('./config');var _config2 = _interopRequireDefault(_config);var _db = require('./db');var _db2 = _interopRequireDefault(_db);var _multidat = require('./multidat');var _multidat2 = _interopRequireDefault(_multidat);var _importers = require('./utils/importers');var _importers2 = _interopRequireDefault(_importers);var _sequentialise = require('./utils/sequentialise');var _sequentialise2 = _interopRequireDefault(_sequentialise);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}function _asyncToGenerator(fn) {return function () {var gen = fn.apply(this, arguments);return new _bluebird2.default(function (resolve, reject) {function step(key, arg) {try {var info = gen[key](arg);var value = info.value;} catch (error) {reject(error);return;}if (info.done) {resolve(value);} else {return _bluebird2.default.resolve(value).then(function (value) {step("next", value);}, function (err) {step("throw", err);});}}return step("next");});};} // This will b removed soon
// eslint-disable-line
// @todo: this.db.close(); should be called on shutdown
const rimrafAsync = _bluebird2.default.promisify(_rimraf2.default); // Class definition
class Catalog extends _events2.default {constructor(baseDir) {var _this;_this = super();this.attachEventListenersAndJoinNetwork = dat => {dat.on('import', this.handleDatImportEvent);dat.on('download metadata', this.handleDatDownloadMetadataEvent);dat.on('sync metadata', this.handleDatSyncMetadataEvent); // dat.on('sync collections', this.handleDatSyncCollectionsEvent);
      return dat.run();};this.ingestDatFile = (() => {var _ref = _asyncToGenerator(function* (data, attempts = 10) {// console.log('trying to import:', data.type, ':', data.file, data.progress);
        const entry = (0, _importers2.default)(data.file, 'calibre');if (entry) {const downloaded = yield _this.multidat.getDat(data.key).hasFile(data.file);const downloadedStr = downloaded ? '[*]' : '[ ]'; // console.log(chalk.bold('adding:'), downloadedStr, data.file);
          const text = _extends({ dat: data.key, state: data.type === 'put', version: data.version }, entry, { downloaded });return _this.db.addTextFromMetadata(text).then(function () {return _this.emit('import', _extends({}, text, { progress: data.progress }));}).then(function () {console.log(`${data.progress.toFixed(2)}%`, 'adding:', downloadedStr, data.file);}).catch(function (e) {if (attempts > 0) {console.log('retry', attempts);return _bluebird2.default.delay(1000).then(function () {return _this.ingestDatFile(data, attempts - 1);});}console.error('errrored', e);return null;}); // Special case of the collections file
        } else if (data.file === '/dat-collections.json' && data.type === 'put') {const dw = yield _this.multidat.getDat(data.key);return _this.ingestDatCollections(dw);}return _bluebird2.default.resolve(false);});return function (_x) {return _ref.apply(this, arguments);};})();this.handleDatImportEvent = data => {console.log(`${data.progress.toFixed(2)}%`, 'import download event.', data.type, ':', data.file);const entry = (0, _importers2.default)(data.file, 'calibre');if (entry) {const text = _extends({ dat: data.key, state: data.type === 'put', version: data.version }, entry, { downloaded: true // downloaed is true as you are importing it, right?
        }); // if this times out we should implement a simple promise queue,
        // so that we just these requests to a list that gets executed when
        // the preceeding functions .then is called.
        this.db.addTextFromMetadata(text).then(() => this.emit('import', _extends({}, text, { progress: data.progress }))).catch(console.error);} else {console.log(`cannot import ${data.file}: maybe not calibre formated?`);}};this.handleDatDownloadMetadataEvent = data => {// this is almost identical to import MetadataEvent except for download flag - TODO: refactor to reduce duplication.
      console.log(`${data.progress.toFixed(2)}%`, 'Metadata download event.', data.type, ':', data.file);const entry = (0, _importers2.default)(data.file, 'calibre');if (entry) {const text = _extends({ dat: data.key, state: data.type === 'put', version: data.version }, entry, { downloaded: false // need to check for downloaded - probaby at this point does not makes sense as we have not even downloaded the metadata.
        }); // if this times out we should implement a simple promise queue,
        // so that we just these requests to a list that gets executed when
        // the preceeding functions .then is called.
        this.db.addTextFromMetadata(text).then(() => this.emit('import', _extends({}, text, { progress: data.progress }))).catch(console.error);} else {console.log(`cannot import ${data.file}: maybe not calibre formated?`);}};this.handleDatSyncMetadataEvent = dat => {console.log('Metadata sync event. Ingesting contents for:', dat);};this.handleDatListingEvent = data => {console.log('Importing: ', data);};this.handleDatListingEndEvent = data => {console.log(data);};this.handleDatSyncCollectionsEvent = dw => {console.log('Collections sync event. Ingesting collections for:', dw.name);this.ingestDatCollections(dw);};this.baseDir = baseDir;this.dats = [];this.db = (0, _sequentialise2.default)(new _db2.default(_path2.default.format({ dir: this.baseDir, base: 'catalog.db' })), { ignore: ['db'], promise: _bluebird2.default });this.multidat = new _multidat2.default(baseDir);this.isReady = false; // For bulk imports we'll use queue
    this.importQueue = [];this.queuing = [];this.queueBatchSize = parseInt(_config2.default.get('queueBatchSize'), 10); // Now, database functions are passed on from this.db
    // explicitly declare publicly accessible database functions
    const publicDatabaseFuncs = ['getDats', 'getAuthors', 'getCollectionAuthors', 'getAuthorLetters', 'getCollections', 'getTitlesWith', 'search', 'getTitlesForAuthor', 'setDownloaded'];publicDatabaseFuncs.forEach(fn => {if (typeof this.db[fn] === 'function') this[fn] = (...args) => this.db[fn](...args);else console.warn(`Database function "${fn}" does not exist and has not been attached to Catalog object.`);});const publicMultidatFuncs = ['copyFromDatToDat'];publicMultidatFuncs.forEach(fn => {if (typeof this.multidat[fn] === 'function') this[fn] = (...args) => this.multidat[fn](...args);else console.warn(`Multidat function "${fn}" does not exist and has not been attached to Catalog object.`);});}init(databaseOnlyMode) {if (databaseOnlyMode) {return this.initDatabase().then(() => this);}return this.initDatabase().then(() => this.initMultidat()).then(() => {this.emit('ready');}).catch(err => this.emit('error', err)).then(() => this);}close() {// close all dats
    return this.multidat.close().then(() => this.emit('closed')).catch(err => this.emit('error', err));}initDatabase() {return this.db.init();}initMultidat() {return this.multidat.init().then(() => this.getDats()).then(dats => this.multidat.initOthers(dats)).then(() => this.cleanupDatRegistry()).then(() => this.multidat.getDats()).each(dw => this.registerDat(dw)).each(dw => this.attachEventListenersAndJoinNetwork(dw));} // Two functions for adding things into the catalog
  // Imports a local directory as a dat into the catalog
  importDir(dir, name = '') {this.multidat.importDir(dir, name).then(dw => this.registerDat(dw)).then(dw => this.attachEventListenersAndJoinNetwork(dw));} // Imports a remote dat repository into the catalog
  importDat(key, name = '') {return this.multidat.importRemoteDat(key, name).then(dw => this.registerDat(dw)).then(dw => this.attachEventListenersAndJoinNetwork(dw)); // .catch(Error, () => console.log(`Dat ${key} failed to import.`));
  } // Forks a dat (by its key) into a new, writable dat
  forkDat(key, name = '') {this.multidat.forkDat(key, name).then(dw => this.registerDat(dw)).then(dw => this.attachEventListenersAndJoinNetwork(dw));} // See db functions in constructor for browsing and searching the catalog.
  // Public call for syncing files within a dat
  // opts can include {dat:, author: , title:, file: }
  checkout(opts) {if (!opts) {console.warn('attempted to checkout without opts.');return _bluebird2.default.reject();} // When the collection option is provided it's handled in a special way
    // because it is downloading across & within authors and maybe across dats
    if (opts.collection) {return this.db.getTitlesWith(opts).then(rows => rows).each(row => this.download(row.dat, row)).then(() => this.scanForDownloads(opts));}if (opts.dat) {if (typeof opts.dat === 'string') {return this.download(opts.dat, opts).then(() => this.scanForDownloads(opts, opts.dat));} else if (Array.isArray(opts.dat)) {return _bluebird2.default.map(opts.dat, dat => this.checkout(_extends({}, opts, { dat })));}console.warn('dat option passed to check is not an array or a string');return _bluebird2.default.reject();} // With no dat provided, we must query for it
    return this.db.getDatsWith(opts).map(row => row.dat).each(dat => this.download(dat, opts)) // .each() passes through the original array
    .then(dats => this.scanForDownloads(opts, _lodash2.default.uniq(dats)));} // ## Dat Management, public functions
  // Rename a dat - updates DB and dat
  renameDat(key, name) {const newPath = _path2.default.format({ dir: this.baseDir, base: name });return this.multidat.getDat(key).then(dat => dat.rename(newPath, name)).then(() => this.db.updateDat(key, name, newPath));} // Delete a dat from registry.
  // Only deletes directory if it's in the baseDir
  removeDat(key, deleteDir = true) {let promise = _bluebird2.default.resolve();if (deleteDir) {const directory = this.multidat.pathToDat(key);if (directory.startsWith(this.baseDir)) {promise = this.db.removeDat(key).then(() => this.db.clearTexts(key)).then(() => rimrafAsync(directory));} /*
                                                                                                                                                                                                                                                                                                 // @todo: fix this because it is better I think?
                                                                                                                                                                                                                                                                                                 return this.multidat.pathToDat(key)
                                                                                                                                                                                                                                                                                                   .then((p) => {
                                                                                                                                                                                                                                                                                                     if (p.startsWith(this.baseDir)) {
                                                                                                                                                                                                                                                                                                       return this.db.removeDat(key)
                                                                                                                                                                                                                                                                                                         .then(() => this.db.clearTexts(key))
                                                                                                                                                                                                                                                                                                         .then(() => this.multidat.deleteDat(key));
                                                                                                                                                                                                                                                                                                     }
                                                                                                                                                                                                                                                                                                     return this.removeDat(key, false);
                                                                                                                                                                                                                                                                                                   });
                                                                                                                                                                                                                                                                                                 */}return promise.then(() => this.multidat.removeDat(key)).then(() => this.db.removeDat(key)).then(() => this.db.clearTexts(key));} // ### private functions
  // Remove dats that are in the DB but haven't been found/ loaded by multidat
  cleanupDatRegistry() {return this.getDats().map(dats => dats).filter(dat => !(dat.dat in this.multidat.dats)).each(dat => {console.log(`Removing: ${_chalk2.default.bold(dat.dir)} from catalog (directory does not exist)`);return this.removeDat(dat.dat, false);}); // .then(() => this.db.clearTexts());
  } // Registers dat the DB
  registerDat(dw) {console.log(`Adding dat (${dw.key}) to the catalog.`);return this.db.removeDat(dw.key).then(() => this.db.addDat(dw.key, dw.name, dw.directory, dw.version)).then(() => this.ingestDatContents(dw)).catch(err => {console.log(err);this.emit('error', err);}).then(() => dw); // at this point we should add all texts within the metadata;
  } // For a Dat, ingest its contents into the catalog
  ingestDatContents(dw) {// rather than clear texts check if metadata is complete
    // only ingest if dat version is > max db version for key
    // or if metadata is incomplete,
    if (dw.metadataComplete) {return this.db.lastImportedVersion(dw.key).then(data => {console.log(data);if (!data.version || data.version < dw.version) {console.log('importing from version', data.version + 1, 'to version', dw.version);return dw.onEachMetadata(this.ingestDatFile, data.version + 1 || 1);}console.log('not importing. already at version ', data.version);return null;});}return this.db.clearTexts(dw.key).then(() => dw.onEachMetadata(this.ingestDatFile));} // Adds an entry from a Dat
  // For a Dat, ingest its collections data (if there are any)
  ingestDatCollections(dw) {this.db.clearCollections(dw.key).then(() => dw.listFlattenedCollections()).each(item => this.ingestDatCollectedFile(dw, item[0], item[1])).catch(() => {});}ingestDatCollectedFile(dw, file, collectionArr, format = 'authorTitle') {const importedData = (0, _importers2.default)(file, format);if (importedData) {const collection = collectionArr.join(';;');console.log(_chalk2.default.bold('collecting:'), file, collection);const data = { dat: dw.key, author: importedData.author, title: importedData.title, collection };return this.db.addCollectedText(data).then(() => this.emit('collect', _extends({}, data, { file })));}return _bluebird2.default.resolve(false);} // Downloads files within a dat
  download(key, opts) {let resource = '';if (opts.author && opts.title && opts.file) {console.log(`checking out ${opts.author}/${opts.title}/${opts.file} from ${key}`);resource = _path2.default.join(opts.author, opts.title, opts.file);} else if (opts.author && opts.title) {console.log(`checking out ${opts.author}/${opts.title} from ${key}`);resource = _path2.default.join(opts.author, opts.title);} else if (opts.author) {console.log(`checking out ${opts.author} from ${key}`);resource = _path2.default.join(opts.author);} else {console.log(`checking out everything from ${opts.dat}`);}return this.multidat.downloadFromDat(key, resource);} // Checks whether a group of catalogue items have been downloaded
  // and if so, then updates the downloaded column in the texts table
  scanForDownloads(opts, dat) {return this.db.getItemsWith(opts, dat).then(rows => rows.filter(doc => this.itemIsDownloaded(doc))).each(row => this.setDownloaded(row.dat, row.author, row.title, row.file));} // Given a row from the texts table, check if it has been downloaded
  itemIsDownloaded(dbRow) {return this.multidat.datHasFile(dbRow.dat, _path2.default.join(dbRow.author, dbRow.title, dbRow.file));} // Event listening
  //
  // When a dat imports a file
  // When a dat's metadata is synced
  // When a dat import process is finished
  // When a dat import process is finished
}exports.Catalog = Catalog;function createCatalog(dataDir, databaseOnlyMode) {// Directory to store all the data in
  let dataDirFinal = _path2.default.join(process.cwd(), _config2.default.get('dataDir'));dataDirFinal = dataDir || dataDirFinal; // Create data directory if it doesn't exist yet
  if (!_fs2.default.existsSync(dataDirFinal)) {_fs2.default.mkdirSync(dataDirFinal);}const catalog = new Catalog(dataDirFinal);return catalog.init(databaseOnlyMode);}exports.default = Catalog;
//# sourceMappingURL=catalog.js.map