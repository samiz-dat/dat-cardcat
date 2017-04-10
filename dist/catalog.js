'use strict';Object.defineProperty(exports, "__esModule", { value: true });exports.Catalog = undefined;var _extends = Object.assign || function (target) {for (var i = 1; i < arguments.length; i++) {var source = arguments[i];for (var key in source) {if (Object.prototype.hasOwnProperty.call(source, key)) {target[key] = source[key];}}}return target;};







// this function can be made a method of dat class too.
exports.





















































































































































































































































































































































































































createCatalog = createCatalog;var _path = require('path');var _path2 = _interopRequireDefault(_path);var _fs = require('fs');var _fs2 = _interopRequireDefault(_fs);var _bluebird = require('bluebird');var _bluebird2 = _interopRequireDefault(_bluebird);var _knex = require('knex');var _knex2 = _interopRequireDefault(_knex);var _chalk = require('chalk');var _chalk2 = _interopRequireDefault(_chalk);var _lodash = require('lodash');var _lodash2 = _interopRequireDefault(_lodash);var _config = require('./config');var _config2 = _interopRequireDefault(_config);var _dat = require('./dat');var _dat2 = _interopRequireDefault(_dat);var _opf = require('./opf');var _filesystem = require('./utils/filesystem');var _importers = require('./utils/importers');var _importers2 = _interopRequireDefault(_importers);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };} // @todo: this.db.close(); should be called on shutdown
function withinDat(query, dat) {if (dat) {if (typeof dat === 'string') {query.where('dat', dat);} else if (Array.isArray(dat)) {query.whereIn('dat', dat);}}return query;} // Class definition
class Catalog {constructor(baseDir) {this.pathIsDownloaded = (dat, filePath) => _fs2.default.existsSync(_path2.default.join(dat.directory, filePath));this.getDats = () => this.db('dats').select();this.getDat = key => this.db('dats').select().where('dat', key);this.baseDir = baseDir;this.dats = [];this.db = (0, _knex2.default)({ client: 'sqlite3', connection: { filename: _path2.default.format({ dir: this.baseDir, base: 'catalog.db' }) }, useNullAsDefault: true }); // If you ever need to see what queries are being run uncomment the following.
    // this.db.on('query', queryData => console.log(queryData));
    this.isReady = false;}initDatabase() {// we should probably setup a simple migration script
    // but for now lets just drop tables before remaking tables.
    const tablesDropped = this.db.schema.dropTableIfExists('datsX').dropTableIfExists('textsX').dropTableIfExists('more_authorsX');return tablesDropped.createTableIfNotExists('dats', table => {table.string('dat');table.string('name');table.string('dir'); // table.unique('dat');
    }).createTableIfNotExists('texts', table => {table.string('dat');table.string('title_hash');table.string('file_hash');table.string('author');table.string('author_sort');table.string('title');table.string('file');table.boolean('downloaded');}).createTableIfNotExists('more_authors', table => {table.string('title_hash');table.string('author'); // table.unique('title_hash');
    }).then(() => {this.isReady = true;}).catch(e => console.error(e));} // Every imported and added dat gets added to the `dats` table of the database. If
  // the directories are deleted then these db entries are useless and should be removed.
  // This will simply confirm that every dat directory in the db still exists.
  cleanupDatsRegistry() {console.log('Cleaning up the dats registry');return this.getDats().map(dat => dat).filter(dat => (0, _filesystem.notADir)(dat.dir)).each(dat => {console.log(`Removing: ${_chalk2.default.bold(dat.dir)} (directory does not exist)`);return this.removeDatFromDb(dat.dat).then(() => this.clearDatEntries(dat.dat));}).then(() => this);} // Look inside the base directory for any directories that seem to be dats
  discoverDats() {return (0, _filesystem.getDirectories)(this.baseDir).map(name => {console.log(`Attempting to load dir: ${_chalk2.default.bold(name)} as a dat`);const opts = { name, createIfMissing: false, sparse: true };return this.importDat(opts);}).then(() => this.cleanupDatsRegistry()).then(() => this.importDatsFromDB()).then(() => this);} // Imports dats listed in the dats table of the database
  importDatsFromDB() {return this.getDats().map(dat => dat).filter(dat => (0, _filesystem.notADir)(dat.dir)) // directory exists
    .filter(dat => !dat.dir.startsWith(this.baseDir)) // not in data directory
    .filter(dat => !(dat.key in this.dats.keys())) // not in registry
    .each(dat => this.importDir(dat.dir, dat.name)).then(() => console.log('Imported dats from DB'));} // Imports a directory on the local filesystem as a dat.
  // This should not be called on any directories inside `dataDir`, which are loaded differently
  importDir(directory, name = false) {console.log(`Attempting to import local directory: ${directory}`);const opts = { directory, name: name || directory.split(_path2.default.sep).slice(-1)[0] };return this.importDat(opts);} // Importing a remote dat by its key
  importRemoteDat(key, name = false) {console.log(`Attempting to import remote dat: ${key}`);const opts = { key, name: name || key, sparse: true };return this.importDat(opts);} // Does the work of importing a functional dat into the catalog
  importDat(opts) {if ('key' in opts && opts.key in this.dats) {// The dat is already loaded, we shouldn't reimport it
      console.log(`You are trying to import a dat that is already loaded: ${opts.key}`);return _bluebird2.default.resolve(false);}if (!opts.directory) {opts.directory = _path2.default.format({ dir: this.baseDir, base: opts.name ? opts.name : opts.key });}const newDat = new _dat2.default(opts, this);return newDat.run().then(() => this.registerDat(newDat)).then(() => newDat.importFiles()).then(() => (0, _dat.listDatContents)(newDat.dat)) // this function can be made a method of dat class too.
    .each(entry => this.importDatEntry(newDat, entry)).catch(err => {console.log(`* Something went wrong when importing ${opts.directory}`);console.log(err);});} // Registers dat in catalog array and in database (@todo)
  registerDat(dw) {const datkey = dw.dat.key.toString('hex');console.log(`Adding dat (${datkey}) to the catalog.`);return this.removeDatFromDb(datkey).then(() => this.clearDatEntries(datkey)).then(() => this.addDatToDb(datkey, dw.name, dw.directory)).finally(() => {this.dats[datkey] = dw;}).catch(e => console.log(e));}addDatToDb(dat, name, dir) {return this.db.insert({ dat, name, dir }).into('dats');}removeDatFromDb(datKey) {return this.db('dats').where('dat', datKey).del();} // Remove all entries for a dat
  clearDatEntries(datKey) {return this.db('texts').where('dat', datKey).del();} // Adds an entry from a Dat
  importDatEntry(dat, entry, format = 'calibre') {const importedData = (0, _importers2.default)(entry, format);if (importedData) {const downloaded = this.pathIsDownloaded(dat, entry.name);const downloadedStr = downloaded ? '[*]' : '[ ]';console.log(_chalk2.default.bold('adding:'), downloadedStr, entry.name);return this.db.insert({ dat: dat.key, title_hash: '', file_hash: '', author: importedData.author, author_sort: importedData.authorSort, title: importedData.title, file: importedData.file, downloaded }).into('texts');}return _bluebird2.default.resolve(false);} // Returns the path to a dat
  // This is broken until i can understand making sqlite async
  pathToDat(datKey) {return this.db.select('dir').from('dats').where('dat', datKey).first();} // Public call for syncing files within a dat
  // opts can include {dat:, author: , title:, file: }
  checkout(opts) {if (!opts) {console.warn('attempted to checkout without opts.');return _bluebird2.default.reject();}if (opts.dat) {if (typeof opts.dat === 'string') {return this.download(opts.dat, opts).then(() => this.scanForDownloads(opts, opts.dat));} else if (Array.isArray(opts.dat)) {return _bluebird2.default.map(opts.dat, dat => this.checkout(_extends({}, opts, { dat })));}console.warn('dat option passed to check is not an array or a string');return _bluebird2.default.reject();} // With no dat provided, we must query for it
    return this.getDatsWith(opts).map(row => row.dat).each(dat => this.download(dat, opts)) // .each() passes through the original array
    .then(dats => this.scanForDownloads(opts, _lodash2.default.uniq(dats)));} // Checks whether a group of catalogue items have been downloaded
  // and if so, then updates the downloaded column in the texts table
  scanForDownloads(opts, dat) {return this.getItemsWith(opts, dat).then(rows => rows.filter(doc => this.itemIsDownloaded(doc))).each(row => this.setDownloaded(row.dat, row.author, row.title, row.file));}download(dat, opts) {if (opts.author && opts.title && opts.file) {console.log(`checking out ${opts.author}/${opts.title}/${opts.file} from ${dat}`);return this.dats[dat].downloadContent(_path2.default.join(opts.author, opts.title, opts.file));} else if (opts.author && opts.title) {console.log(`checking out ${opts.author}/${opts.title} from ${dat}`);return this.dats[dat].downloadContent(_path2.default.join(opts.author, opts.title));} else if (opts.author) {console.log(`checking out ${opts.author} from ${dat}`);return this.dats[dat].downloadContent(_path2.default.join(opts.author));} // If no opts are provided, but a dat is then download the whole dat
    console.log(`checking out everything from ${opts.dat}`);return this.dats[dat].downloadContent();} // Synchronous
  // Given a row from the texts table, check if it has been downloaded
  itemIsDownloaded(dbRow) {return this.pathIsDownloaded(this.dats[dbRow.dat], _path2.default.join(dbRow.author, dbRow.title, dbRow.file));} // Sets download status of a row
  setDownloaded(dat, author, title, file, downloaded = true) {return this.db('texts').where('dat', dat).where('author', author).where('title', title).where('file', file).update({ downloaded });} // Searches for titles with files bundled up in a comma separated column
  search(query, dat) {const s = `%${query}%`;const exp = this.db.select('dat', 'author', 'title', 'title_hash', 'author_sort', this.db.raw('GROUP_CONCAT("file" || ":" || "downloaded") as "files"')).from('texts').where(function () {// a bit inelegant but groups where statements
      this.where('title', 'like', s).orWhere('author', 'like', s);}).groupBy('author', 'title');withinDat(exp, dat);return exp.orderBy('author_sort', 'title');} // Gets a count of authors in the catalog
  getAuthors(startingWith, dat) {const exp = this.db.select('author').from('texts').countDistinct('title as count');withinDat(exp, dat);if (startingWith) {const s = `${startingWith}%`;exp.where('author_sort', 'like', s);}return exp.groupBy('author').orderBy('author_sort');} // Gets a list of letters of authors, for generating a directory
  getAuthorLetters(dat) {const exp = this.db.column(this.db.raw('lower(substr(author_sort,1,1)) as letter')).select();withinDat(exp, dat);return exp.from('texts').distinct('letter').orderBy('letter');}getTitlesForAuthor(author, dat) {const exp = this.db('texts').distinct('dat', 'title').where('author', author);withinDat(exp, dat);return exp.orderBy('title');} // Gets dats containing items described in opts (author/title/file)
  // Optionally provide one or more dats to look within.
  getDatsWith(opts, dat) {return this.getItemsWith(opts, dat, 'dat');} // Like getItemsWith, except some extra work is done to return titles
  // along with a comma-separated list of files:downloaded for each title.
  getTitlesWith(opts, dat) {const exp = this.db.select('dat', 'author', 'title', 'title_hash', 'author_sort', this.db.raw('GROUP_CONCAT("file" || ":" || "downloaded") as "files"')).from('texts');if (opts.author) {exp.where('author', opts.author);}if (opts.title) {exp.where('title', opts.title);}withinDat(exp, dat);return exp.groupBy('author', 'title').orderBy('author_sort', 'title');} // Gets entire entries for catalog items matching author/title/file.
  // Can specify a dat or a list of dats to get within.
  getItemsWith(opts, dat, distinct) {const exp = this.db('texts');if (distinct) {exp.distinct(distinct);}if (opts.author) {exp.where('author', opts.author);}if (opts.title) {exp.where('title', opts.title);}if (opts.file) {exp.where('file', opts.file);}withinDat(exp, dat);return exp.orderBy('dat', 'author', 'title');} // Optionally only include files from a particular dat.
  // Optionally specify a filename to find.
  getFiles(author, title, dat, file) {const exp = this.db('texts').where('author', author).where('title', title);withinDat(exp, dat);if (file) {exp.where('file', file);}return exp.orderBy('dat', 'file');} // Returns opf metadata object for an item, optionally preferring a specific library.
  getOpf(author, title, dat = false) {const mfn = 'metadata.opf'; // metadata file name
    return this.getFiles(author, title, dat, mfn).first().then(row => this.pathToDat(row.dat)).then(fp => (0, _opf.opf2js)(_path2.default.join(fp.dir, author, title, mfn)));}}exports.Catalog = Catalog;function createCatalog(dataDir) {// Directory to store all the data in
  let dataDirFinal = _path2.default.join(process.cwd(), _config2.default.get('dataDir'));dataDirFinal = dataDir || dataDirFinal; // Create data directory if it doesn't exist yet
  if (!_fs2.default.existsSync(dataDirFinal)) {_fs2.default.mkdirSync(dataDirFinal);}const catalog = new Catalog(dataDirFinal);return catalog.initDatabase().then(() => catalog);}exports.default = Catalog;
//# sourceMappingURL=catalog.js.map