'use strict';Object.defineProperty(exports, "__esModule", { value: true });exports.Catalog = undefined;exports.













































































































































































































































































































































































createCatalog = createCatalog;var _path = require('path');var _path2 = _interopRequireDefault(_path);var _fs = require('fs');var _fs2 = _interopRequireDefault(_fs);var _bluebird = require('bluebird');var _bluebird2 = _interopRequireDefault(_bluebird);var _knex = require('knex');var _knex2 = _interopRequireDefault(_knex);var _anotherNameParser = require('another-name-parser');var _anotherNameParser2 = _interopRequireDefault(_anotherNameParser);var _chalk = require('chalk');var _chalk2 = _interopRequireDefault(_chalk);var _config = require('./config');var _config2 = _interopRequireDefault(_config);var _dat = require('./dat');var _dat2 = _interopRequireDefault(_dat);var _opf = require('./opf');var _filesystem = require('./utils/filesystem');function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };} // @todo: this.db.close(); should be called on shutdown
// Class definition
//this function can be made a method of dat class too.
class Catalog {constructor(baseDir) {this.pathIsDownloaded = (dat, filePath) => _fs2.default.existsSync(_path2.default.join(dat.directory, filePath));this.getDats = () => this.db('dats').select();this.getDat = key => this.db('dats').select().where('dat', key);this.baseDir = baseDir;this.dats = [];this.db = (0, _knex2.default)({ client: 'sqlite3', connection: { filename: _path2.default.format({ dir: this.baseDir, base: 'catalog.db' }) }, useNullAsDefault: true });this.isReady = false;}initDatabase() {// we should probably setup a simple migration script
    // but for now lets just drop tables before remaking tables.
    const tablesDropped = this.db.schema.dropTableIfExists('dats').dropTableIfExists('texts').dropTableIfExists('more_authors');return tablesDropped.createTableIfNotExists('dats', table => {table.string('dat');table.string('name');table.string('dir'); // table.unique('dat');
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
  importDatEntry(dat, entry) {const arr = entry.name.split(_path2.default.sep);if (arr[0] === '') {arr.shift();}if (arr.length > 2) {const downloaded = this.pathIsDownloaded(dat, entry.name);const downloadedStr = downloaded ? '[*]' : '[ ]';console.log(_chalk2.default.bold('adding:'), downloadedStr, entry.name);const name = (0, _anotherNameParser2.default)(arr[0]);return this.db.insert({ dat: dat.key, title_hash: '', file_hash: '', author: arr[0], author_sort: `${name.last}, ${name.first}`, title: arr[1], file: arr[2], downloaded }).into('texts');}return _bluebird2.default.resolve(false);} // Returns the path to a dat
  // This is broken until i can understand making sqlite async
  pathToDat(datKey) {return this.db.select('dir').from('dats').where('dat', datKey).first();} // Public call for syncing files within a dat
  // opts can include {dat:, author: , title:, file: }
  checkout(opts) {if (opts.dat) {return this.download(opts.dat, opts).then(() => this.scanForDownloads(opts, opts.dat));} // With no dat provided, we must query for it
    return this.getDatsWith(opts).map(row => row).each(row => this.download(row.dat, opts)).then(() => this.scanForDownloads(opts)); // @todo: somehow get the dat param in here
  } // Checks whether a group of catalogue items have been downloaded
  // and if so, then updates the downloaded column in the texts table
  scanForDownloads(opts, dat = false) {return this.getItemsWith(opts, dat).then(rows => rows.filter(doc => this.itemIsDownloaded(doc))).each(row => this.setDownloaded(row.dat, row.author, row.title, row.file));}download(dat, opts) {if (opts.author && opts.title && opts.file) {console.log(`checking out ${opts.author}/${opts.title}/${opts.file} from ${dat}`);return this.dats[dat].downloadContent(_path2.default.join(opts.author, opts.title, opts.file));} else if (opts.author && opts.title) {console.log(`checking out ${opts.author}/${opts.title} from ${dat}`);return this.dats[dat].downloadContent(_path2.default.join(opts.author, opts.title));} else if (opts.author) {console.log(`checking out ${opts.author} from ${dat}`);return this.dats[dat].downloadContent(_path2.default.join(opts.author));} // If no opts are provided, but a dat is then download the whole dat
    console.log(`checking out everything from ${opts.dat}`);return this.dats[dat].downloadContent();} // Synchronous
  // Given a row from the texts table, check if it has been downloaded
  itemIsDownloaded(dbRow) {return this.pathIsDownloaded(this.dats[dbRow.dat], _path2.default.join(dbRow.author, dbRow.title, dbRow.file));} // Sets download status of a row
  setDownloaded(dat, author, title, file, downloaded = true) {return this.db('texts').where('dat', dat).where('author', author).where('title', title).where('file', file).update({ downloaded });} // Gets a count of authors in the catalog
  search(query) {const s = `%${query}%`;return this.db('texts').where('title', 'like', s).orWhere('author', 'like', s).orderBy('author_sort', 'title_sort');} // Gets a count of authors in the catalog
  getAuthors(startingWith = false) {const exp = this.db.select('author').from('texts').countDistinct('title as count');if (startingWith) {const s = `${startingWith}%`;exp.where('author_sort', 'like', s);}return exp.groupBy('author').orderBy('author_sort');} // Gets a list of letters of authors, for generating a directory
  getAuthorLetters() {return this.db.column(this.db.raw('lower(substr(author_sort,1,1)) as letter')).select().from('texts').distinct('letter').orderBy('letter');}getTitlesForAuthor(author) {return this.db('texts').distinct('dat', 'title').where('author', author).orderBy('title');} // Gets dats containing items described in opts (author/title/file)
  // Optionally provide one or more dats to look within.
  getDatsWith(opts, dat = false) {return this.getItemsWith(opts, dat, 'dat');} // Gets entire entries for catalog items matching author/title/file.
  // Can specify a dat or a list of dats to get within.
  getItemsWith(opts, dat = false, distinct = false) {const exp = this.db('texts');if (distinct) {exp.distinct(distinct);}if (dat) {if (typeof dat === 'string') {exp.where('dat', dat);} else {exp.havingIn('dat', dat);}}if (opts.author) {exp.where('author', opts.author);}if (opts.title) {exp.where('title', opts.title);}if (opts.file) {exp.where('file', opts.file);}return exp.orderBy('dat', 'author', 'title');} // Optionally only include files from a particular dat.
  // Optionally specify a filename to find.
  getFiles(author, title, dat = false, file = false) {const exp = this.db('texts').where('author', author).where('title', title);if (dat) {exp.where('dat', dat);}if (file) {exp.where('file', file);}return exp.orderBy('dat', 'file');} // Returns opf metadata object for an item, optionally preferring a specific library.
  getOpf(author, title, dat = false) {const mfn = 'metadata.opf'; // metadata file name
    return this.getFiles(author, title, dat, mfn).first().then(row => this.pathToDat(row.dat)).then(fp => (0, _opf.opf2js)(_path2.default.join(fp.dir, author, title, mfn)));}}exports.Catalog = Catalog;function createCatalog(dataDir = false) {// Directory to store all the data in
  let dataDirFinal = _path2.default.join(process.cwd(), _config2.default.get('dataDir'));dataDirFinal = dataDir || dataDirFinal; // Create data directory if it doesn't exist yet
  if (!_fs2.default.existsSync(dataDirFinal)) {_fs2.default.mkdirSync(dataDirFinal);}const catalog = new Catalog(dataDirFinal);return catalog.initDatabase().then(() => catalog);}exports.default = Catalog;
//# sourceMappingURL=catalog.js.map