'use strict';Object.defineProperty(exports, "__esModule", { value: true });exports.Catalog = undefined;var _extends = Object.assign || function (target) {for (var i = 1; i < arguments.length; i++) {var source = arguments[i];for (var key in source) {if (Object.prototype.hasOwnProperty.call(source, key)) {target[key] = source[key];}}}return target;};




// This will b removed soon


// eslint-disable-line
exports.






















































































































































































































































































































































































createCatalog = createCatalog;var _path = require('path');var _path2 = _interopRequireDefault(_path);var _fs = require('fs');var _fs2 = _interopRequireDefault(_fs);var _bluebird = require('bluebird');var _bluebird2 = _interopRequireDefault(_bluebird);var _chalk = require('chalk');var _chalk2 = _interopRequireDefault(_chalk);var _lodash = require('lodash');var _lodash2 = _interopRequireDefault(_lodash);var _rimraf = require('rimraf');var _rimraf2 = _interopRequireDefault(_rimraf);var _config = require('./config');var _config2 = _interopRequireDefault(_config);var _db = require('./db');var _db2 = _interopRequireDefault(_db);var _multidat = require('./multidat');var _multidat2 = _interopRequireDefault(_multidat);var _importers = require('./utils/importers');var _importers2 = _interopRequireDefault(_importers);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}function _asyncToGenerator(fn) {return function () {var gen = fn.apply(this, arguments);return new _bluebird2.default(function (resolve, reject) {function step(key, arg) {try {var info = gen[key](arg);var value = info.value;} catch (error) {reject(error);return;}if (info.done) {resolve(value);} else {return _bluebird2.default.resolve(value).then(function (value) {step("next", value);}, function (err) {step("throw", err);});}}return step("next");});};} // @todo: this.db.close(); should be called on shutdown
// Class definition
class Catalog {constructor(baseDir) {this.baseDir = baseDir;this.dats = [];this.db = new _db2.default(_path2.default.format({ dir: this.baseDir, base: 'catalog.db' }));this.multidat = new _multidat2.default(baseDir); // If you ever need to see what queries are being run uncomment the following.
    // this.db.on('query', queryData => console.log(queryData));
    this.isReady = false; // For bulk imports we'll use queue
    this.importQueue = [];this.queuing = [];this.queueBatchSize = parseInt(_config2.default.get('queueBatchSize'), 10); // Now, database functions are passed on from this.db
    // explicitly declare publicly accessible database functions
    const publicDatabaseFuncs = ['getDats', 'getAuthors', 'getCollectionAuthors', 'getAuthorLetters', 'getCollections', 'getTitlesWith', 'search', 'getTitlesForAuthor', 'setDownloaded'];publicDatabaseFuncs.forEach(fn => {if (typeof this.db[fn] === 'function') this[fn] = (...args) => this.db[fn](...args);else console.warn(`Database function "${fn}" does not exist and has not been attached to Catalog object.`);});const publicMultidatFuncs = ['copyFromDatToDat'];publicMultidatFuncs.forEach(fn => {if (typeof this.multidat[fn] === 'function') this[fn] = (...args) => this.multidat[fn](...args);else console.warn(`Multidat function "${fn}" does not exist and has not been attached to Catalog object.`);});}init(databaseOnlyMode) {if (databaseOnlyMode) {return this.initDatabase().then(() => this);}return this.initDatabase().then(() => this.initMultidat()).then(() => this);}initDatabase() {return this.db.init();}initMultidat() {return this.multidat.init().then(() => this.getDats()).then(dats => this.multidat.initOthers(dats)).then(() => this.cleanupDatRegistry()).then(() => this.multidat.getDats()).each(dw => this.registerDat(dw)).each(dw => this.ingestDatContents(dw));} // Two functions for adding things into the catalog
  // Imports a local directory as a dat into the catalog
  importDir(dir, name = '') {this.multidat.importDir(dir, name).then(dw => this.registerDat(dw)).then(dw => this.ingestDatContents(dw));} // Imports a remote dat repository into the catalog
  importDat(key, name = '') {this.multidat.importRemoteDat(key, name).then(dw => this.registerDat(dw)).then(dw => this.ingestDatContents(dw)).catch(Error, () => console.log(`Dat ${key} failed to import.`));} // Forks a dat (by its key) into a new, writable dat
  forkDat(key, name = '') {this.multidat.forkDat(key, name).then(dw => this.registerDat(dw)).then(dw => this.ingestDatContents(dw));} // See db functions in constructor for browsing and searching the catalog.
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
  removeDat(key, deleteDir = true) {let promise = _bluebird2.default.resolve();if (deleteDir) {const directory = this.multidat.pathToDat(key);if (directory.startsWith(this.baseDir)) {const rimrafAsync = _bluebird2.default.promisify(_rimraf2.default);promise = this.db.removeDat(key).then(() => this.db.clearTexts(key)).then(() => rimrafAsync(directory));} /*
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
  cleanupDatRegistry() {return this.getDats().map(dats => dats).filter(dat => !(dat.dat in this.multidat.dats)).each(dat => {console.log(`Removing: ${_chalk2.default.bold(dat.dir)} from catalog (directory does not exist)`);return this.removeDat(dat.dat, false);}).then(() => this.db.clearTexts());} // Registers dat the DB
  registerDat(dw) {const datkey = dw.dat.key.toString('hex');console.log(`Adding dat (${datkey}) to the catalog.`); // listen to events emitted from this dat wrapper
    dw.on('import', (...args) => this.handleDatImportEvent(...args));dw.on('sync metadata', (...args) => this.handleDatSyncMetadataEvent(...args));dw.on('sync collections', (...args) => this.handleDatSyncCollectionsEvent(...args));dw.on('listing data', (...args) => this.handleDatListingEvent(...args));dw.on('listing end', (...args) => this.handleDatListingEndEvent(...args));dw.on('history data', (...args) => this.handleDatHistoryDataEvent(...args));dw.on('history end', (...args) => this.handleDatHistoryEndEvent(...args));return this.db.removeDat(datkey) // .then(() => this.db.clearTexts(datkey))
    .then(() => this.db.addDat(datkey, dw.name, dw.directory, dw.version)).then(() => dw).catch(e => console.log(e));} // For a Dat, ingest its collections data (if there are any)
  ingestDatCollections(dw) {this.db.clearCollections(dw.key).then(() => dw.listFlattenedCollections()).each(item => this.ingestDatCollectedFile(dw, item[0], item[1])).catch();}ingestDatCollectedFile(dw, file, collectionArr, format = 'authorTitle') {const importedData = (0, _importers2.default)(file, format);if (importedData) {const collection = collectionArr.join(';;');console.log(_chalk2.default.bold('collecting:'), file, collection);return this.db.addCollectedText({ dat: dw.key, author: importedData.author, title: importedData.title, collection });}return _bluebird2.default.resolve(false);} // For a Dat, ingest its contents into the catalog
  ingestDatContents(dw) {this.queuing.push(dw.key);return this.db.clearTexts(dw.key).then(() => dw.pumpContents()); // return dw.pumpContents();
    // return dw.replayHistory();
    // this.db.clearTexts(dw.key)
    // .then(() => dw.pumpContents(this.ingestDatFile, this));
    // .then(() => dw.listContents())
    // .each(file => this.ingestDatFile(dw, file));
  }moveTheQueueAlong(dw) {const batch = this.importQueue.splice(0, this.queueBatchSize);console.log('moving the queue along', batch.length, this.importQueue.length);_bluebird2.default.map(batch, item => this.ingestDatFile(item[0], item[1])).filter(item => item).then(queries => this.db.transact(queries)).finally(() => {if (dw) {const r = this.queuing.indexOf(dw.key);if (r > -1) {this.queuing.splice(r, 1);}}}).catch(() => {}); // .then(queries => `${queries.join('; ')};`)
    // .then(query => this.db.transact(query));
    // this.queuing = this.queuing - 1;
  } // Adds an entry from a Dat
  ingestDatFile(dw, file, format = 'calibre') {var _this = this;return _asyncToGenerator(function* () {const importedData = (0, _importers2.default)(file, format);if (importedData) {const downloaded = yield dw.hasFile(file);const downloadedStr = downloaded ? '[*]' : '[ ]'; // console.log(chalk.bold('adding:'), downloadedStr, file);
        const query = _this.db.addText({ dat: dw.key, author: importedData.author, author_sort: importedData.authorSort, title: importedData.title, file: importedData.file, downloaded });if (_this.queuing.length > 0) {return _bluebird2.default.resolve(query.toString());}return query;}return _bluebird2.default.resolve(false);})();} // Downloads files within a dat
  download(key, opts) {let resource = '';if (opts.author && opts.title && opts.file) {console.log(`checking out ${opts.author}/${opts.title}/${opts.file} from ${key}`);resource = _path2.default.join(opts.author, opts.title, opts.file);} else if (opts.author && opts.title) {console.log(`checking out ${opts.author}/${opts.title} from ${key}`);resource = _path2.default.join(opts.author, opts.title);} else if (opts.author) {console.log(`checking out ${opts.author} from ${key}`);resource = _path2.default.join(opts.author);} else {console.log(`checking out everything from ${opts.dat}`);}return this.multidat.downloadFromDat(key, resource);} // Checks whether a group of catalogue items have been downloaded
  // and if so, then updates the downloaded column in the texts table
  scanForDownloads(opts, dat) {return this.db.getItemsWith(opts, dat).then(rows => rows.filter(doc => this.itemIsDownloaded(doc))).each(row => this.setDownloaded(row.dat, row.author, row.title, row.file));} // Given a row from the texts table, check if it has been downloaded
  itemIsDownloaded(dbRow) {return this.multidat.datHasFile(dbRow.dat, _path2.default.join(dbRow.author, dbRow.title, dbRow.file));} // Event listening
  //
  // When a dat's metadata is synced
  handleDatSyncMetadataEvent(dw) {console.log('Metadata sync event. Ingesting contents for:', dw.name);this.ingestDatContents(dw);} // When a dat imports a file
  handleDatImportEvent(dw, filePath, stat) {if (this.queuing.includes(dw.key)) {this.importQueue.push([dw, filePath]);} else {this.ingestDatFile(dw, filePath);} // console.log('Importing: ', filePath);
  } // When a dat import process is finished
  handleDatListingEvent(dw, filePath, stat) {if (this.queuing.includes(dw.key)) {this.importQueue.push([dw, filePath]);if (this.importQueue.length > 0 && this.importQueue.length % this.queueBatchSize === 0) {this.moveTheQueueAlong();}} else {this.ingestDatFile(dw, filePath);} // console.log('Importing: ', filePath);
  } // When a dat import process is finished
  handleDatListingEndEvent(dw, filePath, stat) {if (this.queuing.includes(dw.key)) {this.moveTheQueueAlong(dw);}}handleDatSyncCollectionsEvent(dw) {console.log('Collections sync event. Ingesting collections for:', dw.name);this.ingestDatCollections(dw);} // Reading a piece of history data
  handleDatHistoryDataEvent(dw, data) {if (this.queuing > 0) {this.importQueue.push([dw, data.name]);if (this.importQueue.length % 100 === 0) console.log(this.importQueue.length);} else {console.log('history data:', data.name);}} // End event for reading of history data
  handleDatHistoryEndEvent(dw, data) {console.log('end!!!');}}exports.Catalog = Catalog;function createCatalog(dataDir, databaseOnlyMode) {// Directory to store all the data in
  let dataDirFinal = _path2.default.join(process.cwd(), _config2.default.get('dataDir'));dataDirFinal = dataDir || dataDirFinal; // Create data directory if it doesn't exist yet
  if (!_fs2.default.existsSync(dataDirFinal)) {_fs2.default.mkdirSync(dataDirFinal);}const catalog = new Catalog(dataDirFinal); // @todo: adjust init() to not load any dats, allowing for quick db searches
  return catalog.init(databaseOnlyMode);}exports.default = Catalog;
//# sourceMappingURL=catalog.js.map