import path from 'path';
import db from 'knex';
import Promise from 'bluebird';
import { readOPF } from 'open-packaging-format';
import config from './knexfile';

const GROUP_CONCAT_FILES = 'GROUP_CONCAT(files.path || ":" || files.status || ":" || cats.dat, ";;") as "files"';
const GROUP_CONCAT_AUTHORS = 'GROUP_CONCAT(authors.author || ":" || authors_titles.role, ";;") as "authors"';
const theLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
const otherLetters = 'etc.';

// Narrows query to within a dat/ list of dats
function withinDat(query, catId, joins = []) {
  if (catId) {
    // Always join to the files table, unless joins is explicitly set to false
    if (joins !== false) {
      joins.unshift(['files', 'titles.id', 'files.title_id']);
      for (const join of joins) {
        query.innerJoin(...join);
      }
    }
    if (typeof catId === 'number') {
      query.where('files.cat_id', catId);
    } else if (Array.isArray(catId)) {
      query.whereIn('files.cat_id', catId);
    }
    query.where('files.status', '>', '-1');
  }
  return query;
}

// Narrows query to within a collection/ list of collections
// Note: it is assumed that it is being joined to the `texts` table
function withinColl(query, coll) {
  if (Array.isArray(coll) && coll.length === 0) {
    return query;
  }
  let collCond = coll;
  if (Array.isArray(coll) && coll.length === 1) {
    collCond = coll[0];
  }
  query.innerJoin('collections', function() {
    this
      .on('texts.dat', 'collections.dat')
      .on('texts.author', 'collections.author')
      .on('texts.title', 'collections.title');
  });
  query.column('collections.weight');
  if (typeof collCond === 'string') {
    const s = `${collCond}%`;
    query.where('collections.collection', 'like', s);
  } else if (Array.isArray(collCond)) {
    query.whereIn('collections.collection', collCond);
  }
  return query;
}

// Applies limit and offset to queries through options object
function applyRange(query, opts) {
  const optsNow = {
    limit: 99999,
    offset: 0,
    ...opts,
  };
  query.limit(optsNow.limit).offset(optsNow.offset);
  return query;
}

// Applies sorting to queries through options object
function applySort(query, opts, ...defaults) {
  const optsNow = defaults ? { sort: defaults, ...opts } : opts;
  if (optsNow.sort) {
    query.orderBy(...optsNow.sort);
  }
  return query;
}

//
export class Database {
  // Constructor
  constructor(filename) {
    this.db = db({
      ...config.development,
      connection: {
        filename,
      },
      pool: {
        afterCreate: (conn, cb) => conn.run('PRAGMA foreign_keys = ON', cb),
      }
    });
    // If you ever need to see what queries are being run uncomment the following.
    // this.db.on('query', queryData => console.log(queryData));
    this.letters = {};
    this.catIds = {};
  }

  // Initializes tables
  init() {
    return this.db.migrate.latest(config.development.migration)
      .then(() => { this.isReady = true; })
      .then(() => this.refreshCatIdsCache())
      .catch(e => console.error(e));
  }

  // Returns the database id for a dat key. Cached for performance
  getCatId(datKey) {
    // return from cache
    if (this.catIds[datKey]) {
      return this.catIds[datKey];
    }
    return false;
  }

  // Makes sure the catalog id lookup cache is up to date
  refreshCatIdsCache() {
    return this.db.select('id', 'dat')
      .from('cats')
      .then((cats) => {
        this.catIds = {};
        for (const doc of cats) this.catIds[doc.dat] = doc.id;
      });
  }

  // Add a dat to the database
  addDat(dat, name, dir, version, format) {
    // Handle non-hex, non-64 digits
    if (!dat) return Promise.reject();
    if (dat.length !== 64 || dat.search(/[0-9A-F]/gi) === -1) return Promise.reject();
    // Otherwise
    return this.pathToDat(dat)
    .then((p) => {
      if (!p) return this.db.insert({ dat, name, dir, version, format }).into('cats').tap(() => this.refreshCatIdsCache());
      return Promise.reject();
    });
  }

  // Remove a dat from the database
  removeDat(datKey) {
    return this.db('cats').where('dat', datKey).del();
  }

  // Update a dat's name and directory
  updateDat(datKey, opts) {
    if (!datKey) return Promise.reject('no dat key provided');
    return this.db('cats')
      .where('dat', datKey)
      .update(opts);
  }

  // Remove all entries/ texts for a dat
  clearTexts(datKey) {
    return this.clearFiles(datKey)
      .tap(() => this.clearEmptyTitles())
      .tap(() => this.clearEmptyAuthors()); // @TODO: this will need to be generalized to all metadata
  }

  // Clear out all entries in `files` table (optional datKey)
  clearFiles(datKey) {
    const catId = this.getCatId(datKey);
    if (catId) {
      return this.db('files').where('cat_id', catId).del();
    }
    // Truncate the files table
    return this.db('files').del();
  }

  // Clear out all titles that don't have any files
  clearEmptyTitles() {
    return this.db('titles').whereIn('id', function() {
      this.select('titles.id')
      .from('titles')
      .leftJoin('files', 'titles.id', 'files.title_id')
      .where('files.id', null);
    }).del();
  }

  // Clear out all authors that don't have any titles
  clearEmptyAuthors() {
    return this.db('authors').whereIn('id', function() {
      this.select('authors.id')
      .from('authors')
      .leftJoin('authors_titles', 'authors.id', 'authors_titles.author_id')
      .where('authors_titles.title_id', null);
    }).del();
  }

  // Remove all collection entries for a dat
  // @TODO:
  clearCollections(datKey, collection) {
    if (datKey) {
      if (collection) {
        return this.db('collections')
        .where({
          dat: datKey,
          collection,
        }).del();
      }
      return this.db('collections').where('dat', datKey).del();
    }
    return this.db('collections').del();
  }

  // Returns the path to a dat as found in db.
  pathToDat(datKey) {
    return this.db.select('dir').from('cats').where('dat', datKey).first();
  }

  lastImportedVersion(datKey) {
    const catId = this.getCatId(datKey);
    if (!catId) return Promise.reject();
    return this.db('files')
      .max('version as version')
      .where('cat_id', catId)
      .whereNotNull('version')
      .first()
      .then(row => row.version);
  }

  // Adds a new title or finds the existing one for author/title combo
  addTitle(opts) {
    return this.db('titles')
      .where({
        author_sort: opts.author_sort,
        title: opts.title,
      })
      .first()
      .then((row) => {
        if (!row) {
          return this.db('titles').insert({
            author_sort: opts.author_sort,
            title_sort: opts.title_sort || opts.title,
            title: opts.title,
          })
          .then(id => id[0]);
        }
        return Promise.resolve(row.id);
      });
  }

  // Adds a new file or finds existing one
  addFile(opts) {
    const catId = this.getCatId(opts.dat);
    return this.db('files')
      .where('cat_id', catId)
      .where('path', opts.path)
      .first()
      .then((row) => {
        let promise = -1;
        // console.log(opts.version, 'version!');
        if (!row) {
          // add new file
          promise = this.db('files').insert({
            cat_id: catId,
            title_id: opts.titleId,
            version: opts.version,
            status: opts.status || 0,
            path: opts.path,
            is_metadata: opts.isMetadata || 0,
            is_cover: opts.isCover || 0,
          });
        } else if (opts.version > row.version) {
          // update state and version if this text is newer version
          promise = this.db('files').update({
            version: opts.version,
            status: opts.status, // state stored del or pul status as a bool
          }).where('id', row.id);
        }
        return Promise.resolve(promise);
      });
  }

  // Adds relation
  addAuthorTitle(authorId, titleId, role, order) {
    return this.db('authors_titles')
      .where({
        author_id: authorId,
        title_id: titleId,
      })
      .first()
      .then((row) => {
        if (!row) {
          return this.db('authors_titles').insert({
            author_id: authorId,
            title_id: titleId,
            role: role || '',
            order: order || 0,
          });
        }
        return Promise.resolve(true);
      });
  }

  // opts must include `author`, `author_sort`, and `titleId`. `role` is optional
  addAuthor(opts, order) {
    return this.db('authors')
      .where({
        author_sort: opts.author_sort,
      })
      .first()
      .then((row) => {
        if (!row) {
          return this.db('authors').insert({
            author: opts.author,
            author_sort: opts.author_sort,
          })
          .then(id => id[0]);
        }
        return Promise.resolve(row.id);
      })
      .then(id => this.addAuthorTitle(id, opts.titleId, opts.role, order));
  }

  // Adds authors for a title
  addAuthors(opts) {
    // Handle single author case
    if (opts.author) {
      return this.addAuthor(opts);
    } else if (opts.authors) {
      return Promise.map(opts.authors, (a) => {
        a.titleId = opts.titleId;
        return a;
      })
      .each((a, i) => this.addAuthor(a, i));
    }
    return Promise.reject();
  }

  addTextFromMetadata(opts) {
    // Do we need to invalidate any caches?
    const letter = opts.author_sort.charAt(0).toLowerCase();
    if (this.letters[opts.dat] && !this.letters[opts.dat].includes(letter)) {
      this.letters[opts.dat] = undefined;
    }
    if (this.letters.all && !this.letters.all.includes(letter)) {
      this.letters.all = undefined;
    }
    // Now do the inserting
    return this.addTitle(opts)
      .then((id) => {
        opts.titleId = id;
        return this.addFile(opts)
        .then(() => this.addAuthors(opts));
      });
  }

  // Inserts a row for a collected text
  addCollectedText(opts) {
    return this.db.insert({
      dat: opts.dat,
      author: opts.author,
      title: opts.title,
      collection: opts.collection,
      weight: opts.weight || 0,
    }).into('collections');
  }

  // Sets download status of a row
  setDownloaded(dat, file, downloaded = true) {
    const catId = this.getCatId(dat);
    const status = (downloaded) ? 1 : 0;
    return this.db('files')
      .where({
        cat_id: catId,
        path: file,
      })
      .update({
        status,
      });
  }

  // Gives a count of search results
  countSearch(query, opts) {
    const s = `%${query}%`;
    return this.countTitlesWith({ ...opts, search: s });
  }

  // Searches for titles with files bundled up in a comma separated column
  search(query, opts) {
    const s = `%${query}%`;
    return this.getTitlesWith({ ...opts, search: s });
  }

  // Gets a count of authors in the catalog
  countAuthors(startingWith, opts) {
    const exp = this.db.countDistinct('authors.author as num').from('authors');
    if (opts) {
      withinDat(exp, this.getCatId(opts.dat),
        [['authors_titles', 'authors.id', 'authors_titles.author_id'],
        ['titles', 'authors_titles.title_id', 'titles.id']]);
    }
    if (startingWith && startingWith === otherLetters) {
      for (const letter of theLetters) {
        exp.whereNot('authors.author_sort', 'like', `${letter}%`);
      }
    } else if (startingWith) {
      const s = `${startingWith}%`;
      exp.where('authors.author_sort', 'like', s);
    }
    if (opts) {
      if (opts.collection) {
        withinColl(exp, opts.collection);
      }
    }
    return exp
      .first()
      .then(rows => rows.num);
  }

  // Gets authors in the catalog
  getAuthors(startingWith, opts) {
    const exp = this.db.select('authors.author').from('authors')
      .innerJoin('authors_titles', 'authors.id', 'authors_titles.author_id')
      .countDistinct('authors_titles.title_id as count');
    if (opts) withinDat(exp, this.getCatId(opts.dat), [['titles', 'authors_titles.title_id', 'titles.id']]);
    if (startingWith && startingWith === otherLetters) {
      for (const letter of theLetters) {
        exp.whereNot('authors.author_sort', 'like', `${letter}%`);
      }
    } else if (startingWith) {
      const s = `${startingWith}%`;
      exp.where('authors.author_sort', 'like', s);
    }
    if (opts) {
      if (opts.collection) {
        withinColl(exp, opts.collection);
      }
      applyRange(exp, opts);
      applySort(exp, opts, 'authors.author_sort', 'asc');
    }
    return exp.groupBy('authors.author');
  }

  // Gets a list of letters of authors, for generating a directory
  getAuthorLetters(opts) {
    const cacheKey = (opts.dat) ? opts.dat : 'all';
    // return from cache
    if (this.letters[cacheKey]) {
      return Promise.resolve(this.letters[cacheKey]);
    }
    const exp = this.db.column(this.db.raw('lower(substr(authors.author_sort,1,1)) as letter'))
      .select();
    if (opts) {
      withinDat(exp, this.getCatId(opts.dat),
        [['authors_titles', 'authors.id', 'authors_titles.author_id'],
        ['titles', 'authors_titles.title_id', 'titles.id']]);
      if (opts.collection) {
        withinColl(exp, opts.collection);
      }
    }
    return exp.from('authors')
      .distinct('letter')
      .orderBy('letter')
      .then((rows) => {
        // Put into cache & reduce non-characters to "etc."
        this.letters[cacheKey] = rows.map(doc => doc.letter).reduce((compressed, letter) => {
          if (theLetters.includes(letter)) return compressed.concat(letter);
          else if (!compressed.includes(otherLetters)) return compressed.concat(otherLetters);
          return compressed;
        }, []);
        return this.letters[cacheKey];
      });
  }

  // Counting total results for getTitlesWith query
  countTitlesWith(opts) {
    const exp = this.db
      .countDistinct('titles.title as num')
      .from('titles')
      .innerJoin('authors_titles', 'titles.id', 'authors_titles.title_id')
      .innerJoin('authors', 'authors_titles.author_id', 'authors.id');
    if (opts.author) {
      exp.where('authors.author', opts.author);
    }
    if (opts.title) {
      exp.where('titles.title', opts.title);
    }
    if (opts.search) {
      exp.andWhere(function () { // a bit inelegant but groups where statements
        this.where('titles.title', 'like', opts.search)
          .orWhere('authors.author', 'like', opts.search);
      });
    }
    if (opts.collection) {
      withinColl(exp, opts.collection);
    }
    if (opts) {
      withinDat(exp, this.getCatId(opts.dat));
    }
    return exp
      .first()
      .then(rows => rows.num);
  }

  // Like getItemsWith, except some extra work is done to return titles
  // along with a comma-separated list of files:downloaded for each title.
  getTitlesWith(opts) {
    const exp = this.db
      .select('titles.title',
        'titles.author_sort',
        // These will produce duplicates and it's not possible to use DISTINCT with custom separator,
        // so I suggest we handle de-duplicating in the result set, below
        this.db.raw(GROUP_CONCAT_FILES),
        this.db.raw(GROUP_CONCAT_AUTHORS))
      .from('titles')
      .innerJoin('files', 'titles.id', 'files.title_id')
      .innerJoin('cats', 'files.cat_id', 'cats.id')
      .innerJoin('authors_titles', 'titles.id', 'authors_titles.title_id')
      .innerJoin('authors', 'authors_titles.author_id', 'authors.id')
      .where('files.status', '>', -1);
    if (opts.author) {
      exp.where('authors.author', opts.author);
    }
    if (opts.title) {
      exp.where('titles.title', opts.title);
    }
    if (opts.search) {
      exp.andWhere(function () { // a bit inelegant but groups where statements
        this.where('titles.title', 'like', opts.search)
          .orWhere('authors.author', 'like', opts.search);
      });
    }
    if (opts.collection) {
      withinColl(exp, opts.collection);
    }
    if (opts) {
      withinDat(exp, this.getCatId(opts.dat), false);
    }
    applyRange(exp, opts);
    applySort(exp, opts, 'titles.author_sort', 'asc');
    return exp
      .groupBy('titles.author_sort', 'titles.title')
      // This last step is to de-duplicate the group_concats above
      .map((result) => {
        result.authors = Array.from(new Set(result.authors.split(';;'))).map(a => a.split(':'));
        result.files = Array.from(new Set(result.files.split(';;'))).map(f => f.split(':'));
        return result;
      });
  }

  // Gets all of the files like [{ dat: ..., path: ... }, ...]
  getFilesWith(opts) {
    const exp = this.db
      .select('files.id',
        'files.path',
        'cats.dat')
      .from('titles')
      .innerJoin('files', 'titles.id', 'files.title_id')
      .innerJoin('cats', 'files.cat_id', 'cats.id')
      .innerJoin('authors_titles', 'titles.id', 'authors_titles.title_id')
      .innerJoin('authors', 'authors_titles.author_id', 'authors.id')
      .where('files.status', '>', -1);
    if (opts.author) {
      exp.where('authors.author', opts.author);
    }
    if (opts.title) {
      exp.where('titles.title', opts.title);
    }
    if (opts.collection) {
      withinColl(exp, opts.collection);
    }
    if (opts) {
      withinDat(exp, this.getCatId(opts.dat), false);
    }
    applyRange(exp, opts);
    applySort(exp, opts, 'cats.dat', 'asc');
    return exp
      .groupBy('files.id');
  }

  // Gets a list of collections in the catalog
  getCollections(startingWith, opts) {
    const exp = this.db.select('collection').from('collections')
      .count('* as count');
    if (opts) {
      withinDat(exp, this.getCatId(opts.dat));
    }
    if (startingWith) {
      const s = `${startingWith}%`;
      exp.where('collection', 'like', s);
    }
    applyRange(exp, opts);
    applySort(exp, opts, 'collection', 'asc');
    return exp
      .groupBy('collection');
  }

  getDownloadCounts(dat) {
    const exp = this.db.select('files.status').from('files')
      .count('files.path as count');
    if (dat) {
      withinDat(exp, this.getCatId(dat), false);
    } else {
      exp.where('files.status', '>', -1);
    }
    return exp
      .groupBy('files.status')
      .then(result => result.reduce((r, a) => {
        r[a.status] = a.count;
        return r;
      }, {}));
  }

  getDats = () => this.db('cats').select();
  getDat = key => this.db('cats').select().where('dat', key).first();

  // Returns opf metadata object for an item, optionally preferring a specific library.
  getOpf(author, title, dat) {
    // @ todo - this is currently broken because of sequentialise - remove this.fn() calls
    const mfn = 'metadata.opf'; // metadata file name
    return this.getFiles(author, title, { dat, file: mfn }).first()
      .then(row => this.pathToDat(row.dat))
      .then(fp => readOPF(path.join(fp.dir, author, title, mfn)));
  }
}

export default Database;
