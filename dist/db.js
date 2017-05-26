'use strict';Object.defineProperty(exports, "__esModule", { value: true });exports.Database = undefined;var _path = require('path');var _path2 = _interopRequireDefault(_path);
var _knex = require('knex');var _knex2 = _interopRequireDefault(_knex);
var _bluebird = require('bluebird');var _bluebird2 = _interopRequireDefault(_bluebird);
var _openPackagingFormat = require('open-packaging-format');function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}function _asyncToGenerator(fn) {return function () {var gen = fn.apply(this, arguments);return new _bluebird2.default(function (resolve, reject) {function step(key, arg) {try {var info = gen[key](arg);var value = info.value;} catch (error) {reject(error);return;}if (info.done) {resolve(value);} else {return _bluebird2.default.resolve(value).then(function (value) {step("next", value);}, function (err) {step("throw", err);});}}return step("next");});};}

// Narrows query to within a dat/ list of dats
function withinDat(query, dat, table = 'texts') {
  if (dat) {
    if (typeof dat === 'string') {
      query.where(`${table}.dat`, dat);
    } else if (Array.isArray(dat)) {
      query.whereIn(`${table}.dat`, dat);
    }
  }
  return query;
}

class Database {
  // Constructor
  constructor(filename) {this.











































































































































































































































































































    getDats = () => this.db('dats').select();this.
    getDat = key => this.db('dats').select().where('dat', key);this.db = (0, _knex2.default)({ client: 'sqlite3', connection: { filename }, useNullAsDefault: true });}transact(queries) {console.log('transact(queries)', queries.length);if (queries.length === 0) {return _bluebird2.default.resolve(false);}return this.doTransaction(queries);}doTransaction(queries) {var _this = this;return _asyncToGenerator(function* () {if (queries.length === 0) {return _bluebird2.default.resolve(false);}const q = yield _this.db.raw('BEGIN TRANSACTION').then(function () {_bluebird2.default.each(queries, function (query) {return _this.db.raw(`${query}`);});}).then(function () {return _this.db.raw('COMMIT');}).catch(function (e) {return console.log(e);});return q;})();} // Add a dat to the database
  addDat(dat, name, dir, version) {return this.db.insert({ dat, name, dir, version }).into('dats');} // Remove a dat from the database
  removeDat(datKey) {return this.db('dats').where('dat', datKey).del();} // Update a dat's name and directory
  updateDat(datKey, name, dir) {return this.db('dats').where('dat', datKey).update({ name, dir });} // Remove all entries/ texts for a dat
  clearTexts(datKey) {if (datKey) {return this.db('texts').where('dat', datKey).del();}return this.db('texts').del();} // Remove all collection entries for a dat
  clearCollections(datKey) {if (datKey) {return this.db('collections').where('dat', datKey).del();}return this.db('collections').del();} // Returns the path to a dat as found in db.
  pathToDat(datKey) {return this.db.select('dir').from('dats').where('dat', datKey).first();} // Insert a text into the texts table
  addText(opts) {const p = this.db.insert({ dat: opts.dat, title_hash: opts.title_hash || '', file_hash: opts.file_hash || '', author: opts.author, author_sort: opts.author_sort, title: opts.title, file: opts.file, downloaded: opts.downloaded || 0 }).into('texts');if (this.transacting) {this.transactionStatements.push(p.toString());return _bluebird2.default.resolve(true);}return p;} // Only adds the text if it's not yet in the database
  checkAndAddText(opts) {return this.db.transaction(trx => {this.db('texts').transacting(trx).insert({ dat: opts.dat, title_hash: opts.title_hash || '', file_hash: opts.file_hash || '', author: opts.author, author_sort: opts.author_sort, title: opts.title, file: opts.file, downloaded: opts.downloaded || 0 }).whereNotExists(this.db('texts').transacting(trx).where('dat', opts.dat).where('author', opts.author).where('title', opts.title).where('file', opts.file)).then(trx.commit).catch(trx.rollback);}).then(() => {// console.log('Transaction complete.');
    }).catch(err => {console.error(err);}); /*
                                            return this.addText(opts)
                                              .whereNotExists(this.db('texts')
                                                .where('dat', opts.dat)
                                                .where('author', opts.author)
                                                .where('title', opts.title)
                                                .where('file', opts.file));
                                            */} // Inserts a row for a collected text
  addCollectedText(opts) {return this.db.insert({ dat: opts.dat, author: opts.author, title: opts.title, collection: opts.collection }).into('collections');} // Sets download status of a row
  setDownloaded(dat, author, title, file, downloaded = true) {return this.db('texts').where('dat', dat).where('author', author).where('title', title).where('file', file).update({ downloaded });} // Searches for titles with files bundled up in a comma separated column
  search(query, dat) {const s = `%${query}%`;const exp = this.db.select('dat', 'author', 'title', 'title_hash', 'author_sort', this.db.raw('GROUP_CONCAT("file" || ":" || "downloaded") as "files"')).from('texts').where(function () {// a bit inelegant but groups where statements
      this.where('title', 'like', s).orWhere('author', 'like', s);}).groupBy('author', 'title');withinDat(exp, dat);return exp.orderBy('author_sort', 'title');} // Gets a count of authors in the catalog
  getAuthors(startingWith, dat) {const exp = this.db.select('texts.author').from('texts').countDistinct('texts.title as count');withinDat(exp, dat);if (startingWith) {const s = `${startingWith}%`;exp.where('texts.author_sort', 'like', s);}return exp.groupBy('texts.author').orderBy('texts.author_sort');} // Gets authors within a collection
  getCollectionAuthors(collection, startingWith, dat) {const q = this.getAuthors(startingWith, dat);q.countDistinct('collections.title as count'); // count inside the collection instead
    const s = `${collection}%`;return q.innerJoin('collections', 'texts.author', 'collections.author').where('collections.collection', 'like', s);} // Gets a list of letters of authors, for generating a directory
  getAuthorLetters(dat) {const exp = this.db.column(this.db.raw('lower(substr(author_sort,1,1)) as letter')).select();withinDat(exp, dat);return exp.from('texts').distinct('letter').orderBy('letter');}getTitlesForAuthor(author, dat) {const exp = this.db('texts').distinct('dat', 'title').where('author', author);withinDat(exp, dat);return exp.orderBy('title');} // Like getItemsWith, except some extra work is done to return titles
  // along with a comma-separated list of files:downloaded for each title.
  getTitlesWith(opts, dat) {const exp = this.db.select('texts.dat', 'texts.author', 'texts.title', 'texts.title_hash', 'texts.author_sort', this.db.raw('GROUP_CONCAT("texts.file" || ":" || "texts.downloaded") as "files"')).from('texts');if (opts.author) {exp.where('texts.author', opts.author);}if (opts.title) {exp.where('texts.title', opts.title);}if (opts.collection) {const s = `${opts.collection}%`;exp.innerJoin('collections', function () {this.on('texts.dat', 'collections.dat').on('texts.author', 'collections.author').on('texts.title', 'collections.title');}).where('collections.collection', 'like', s);}withinDat(exp, dat);return exp.groupBy('texts.author', 'texts.title').orderBy('texts.author_sort', 'texts.title');} // Gets entire entries for catalog items matching author/title/file.
  // Can specify a dat or a list of dats to get within.
  getItemsWith(opts, dat, distinct) {const exp = this.db('texts');if (distinct) {exp.distinct(distinct);}if (opts.author) {exp.where('texts.author', opts.author);}if (opts.title) {exp.where('texts.title', opts.title);}if (opts.file) {exp.where('texts.file', opts.file);}if (opts.collection) {const s = `${opts.collection}%`;exp.innerJoin('collections', function () {this.on('texts.dat', 'collections.dat').on('texts.author', 'collections.author').on('texts.title', 'collections.title');}).where('collections.collection', 'like', s);}withinDat(exp, dat || opts.dat);return exp.orderBy('texts.dat', 'texts.author', 'texts.title');} // Gets a list of collections in the catalog
  getCollections(startingWith, dat) {const exp = this.db.select('collection').from('collections').count('* as count');withinDat(exp, dat);if (startingWith) {const s = `${startingWith}%`;exp.where('collection', 'like', s);}return exp.groupBy('collection').orderBy('collection');} // Optionally only include files from a particular dat.
  // Optionally specify a filename to find.
  getFiles(author, title, dat, file) {const exp = this.db('texts').where('author', author).where('title', title);withinDat(exp, dat);if (file) {exp.where('file', file);}return exp.orderBy('dat', 'file');} // Gets dats containing items described in opts (author/title/file)
  // Optionally provide one or more dats to look within.
  getDatsWith(opts, dat) {return this.getItemsWith(opts, dat, 'dat');} // Returns opf metadata object for an item, optionally preferring a specific library.
  getOpf(author, title, dat = false) {const mfn = 'metadata.opf'; // metadata file name
    return this.getFiles(author, title, dat, mfn).first().then(row => this.pathToDat(row.dat)).then(fp => (0, _openPackagingFormat.readOPF)(_path2.default.join(fp.dir, author, title, mfn)));} // Initializes tables
  init() {// we should probably setup a simple migration script
    // but for now lets just drop tables before remaking tables.
    const tablesDropped = this.db.schema.dropTableIfExists('datsX').dropTableIfExists('textsX').dropTableIfExists('more_authorsX');return tablesDropped.createTableIfNotExists('dats', table => {table.string('dat');table.string('name');table.string('dir');table.integer('version'); // table.unique('dat');
    }).createTableIfNotExists('texts', table => {table.string('dat');table.string('title_hash');table.string('file_hash');table.string('author');table.string('author_sort');table.string('title');table.string('file');table.boolean('downloaded');}).
    createTableIfNotExists('collections', table => {
      table.string('dat');
      table.string('author');
      table.string('title');
      table.string('collection');
    }).
    createTableIfNotExists('more_authors', table => {
      table.string('title_hash');
      table.string('author');
      // table.unique('title_hash');
    }).
    then(() => {this.isReady = true;}).
    catch(e => console.error(e));
  }}exports.Database = Database;exports.default =


Database;
//# sourceMappingURL=db.js.map