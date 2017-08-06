import chai from 'chai';
import temp from 'temp';
import path from 'path';
import Database from '../src/db';

const expect = chai.expect;

const temporaryDir = './temp';

describe('database', () => {
  let database;

  before(() => {
    temp.track();
    const tmpPath = temp.mkdirSync(temporaryDir);
    database = new Database(path.join(tmpPath, 'test.db'));
  });

  after(() => {
    temp.cleanupSync();
  });

  context('when data is only derived from file structure parsing', () => {
    describe('.addDat(dat, name, dir, version, format)', () => {
      it('adds a dat to the db', () => {

      });
    });

    describe('.removeDat(key)', () => {
      it('removes a dat with the specified key from the db', () => {

      });
    });

    describe('.updateDat(datKey, opts)', () => {
      it('updates dat in db with specific key', () => {

      });
    });

    describe('clearTexts(datKey)', () => {
      it('clears all texts from db', () => {

      });
      it('clears all texts from only specified dat', () => {

      });
    });

    describe('lastImportedVersion(datKey)', () => {
      it('returns the maximium version of a file imported from a specific dat', () => {

      });
      it('throws an error if no dat key is provided', () => {

      });
    });

    describe('addTextFromMetadata(opts)', () => {
      // Do we need to invalidate any caches?
      // const letter = opts.author_sort.charAt(0).toLowerCase();
      // if (this.letters[opts.dat] && !this.letters[opts.dat].includes(letter)) {
      //   this.letters[opts.dat] = undefined;
      // }
      // if (this.letters.all && !this.letters.all.includes(letter)) {
      //   this.letters.all = undefined;
      // }
      // // Now do the inserting
      // return this.db('texts')
      //   .where({
      //     dat: opts.dat,
      //     author: opts.author,
      //     title: opts.title,
      //     file: opts.file,
      //   })
      //   .first()
      //   .then((row) => {
      //     let promise = -1;
      //     // console.log(opts.version, 'version!');
      //     if (!row) {
      //       // add new text
      //       promise = this.db('texts').insert({
      //         dat: opts.dat,
      //         version: opts.version,
      //         state: opts.state,
      //         title_hash: opts.title_hash || '',
      //         file_hash: opts.file_hash || '',
      //         author: opts.author,
      //         author_sort: opts.author_sort,
      //         title: opts.title,
      //         file: opts.file,
      //         downloaded: opts.downloaded || 0,
      //       });
      //     } else if (opts.version > row.version) {
      //       // update state and version if this text is newer version
      //       promise = this.db('texts').update({
      //         version: opts.version,
      //         state: opts.state, // state stored del or pul status as a bool
      //       }).where('text_id', row.text_id);
      //     }
      //     return Promise.resolve(promise);
      //   });
    });

    // Sets download status of a row
    describe('setDownloaded(dat, author, title, file, downloaded = true)', () => {
      it('sets the download status of a file', () => {
        // return this.db('texts')
        // .where('dat', dat)
        // .where('author', author)
        // .where('title', title)
        // .where('file', file)
        // .update({
        //   downloaded,
        // });
      });
    });

    describe('countSearch(query, opts)', () => {
      it('returns the number items for a search', () => {
        // const s = `%${query}%`;
        // const exp = this.db
        //   .count('titles as num')
        //   .from(function() {
        //     this.distinct('dat', 'author', 'title', 'state').from('texts').as('texts');
        //   })
        //   .where('state', true)
        //   .andWhere(function () { // a bit inelegant but groups where statements
        //     this.where('title', 'like', s)
        //       .orWhere('author', 'like', s);
        //   });
        // if (opts) {
        //   withinDat(exp, opts.dat);
        // }
        // return exp
        //   .first()
        //   .then(rows => rows.num);
      });
    });

    describe('search(query, opts)', () => {
      it('returns search results for a query with files in a ;;-separated column', () => {
        // const s = `%${query}%`;
        // const exp = this.db
        //   .select('dat',
        //     'author',
        //     'title',
        //     'title_hash',
        //     'author_sort',
        //   this.db.raw(GROUP_CONCAT_FILES))
        //   .from('texts')
        //   .where('state', true)
        //   .andWhere(function () { // a bit inelegant but groups where statements
        //     this.where('title', 'like', s)
        //       .orWhere('author', 'like', s);
        //   })
        //   .groupBy('author', 'title');
        // if (opts) {
        //   withinDat(exp, opts.dat);
        //   applyRange(exp, opts);
        //   applySort(exp, opts, 'author_sort', 'asc');
        // }
        // return exp;
      });
    });

    // Gets a count of authors in the catalog
    describe('countAuthors(startingWith, opts)', () => {
      it('returns a count of authors', () => {
        // const exp = this.db.countDistinct('texts.author as num').from('texts');
        // if (opts) withinDat(exp, opts.dat);
        // if (startingWith && startingWith === otherLetters) {
        //   for (const letter of theLetters) {
        //     exp.whereNot('texts.author_sort', 'like', `${letter}%`);
        //   }
        // } else if (startingWith) {
        //   const s = `${startingWith}%`;
        //   exp.where('texts.author_sort', 'like', s);
        // }
        // if (opts) {
        //   if (opts.collection) {
        //     withinColl(exp, opts.collection);
        //   }
        // }
        // return exp
        //   .where('texts.state', true)
        //   .first()
        //   .then(rows => rows.num);
      });
    });

    // Gets authors in the catalog
    describe('getAuthors(startingWith, opts)', () => {
      it('gets all authors associated with a text', () => {
        // const exp = this.db.select('texts.author').from('texts')
        //   .countDistinct('texts.title as count');
        // if (opts) withinDat(exp, opts.dat);
        // if (startingWith && startingWith === otherLetters) {
        //   for (const letter of theLetters) {
        //     exp.whereNot('texts.author_sort', 'like', `${letter}%`);
        //   }
        // } else if (startingWith) {
        //   const s = `${startingWith}%`;
        //   exp.where('texts.author_sort', 'like', s);
        // }
        // if (opts) {
        //   if (opts.collection) {
        //     withinColl(exp, opts.collection);
        //   }
        //   applyRange(exp, opts);
        //   applySort(exp, opts, 'author_sort', 'asc');
        // }
        // return exp
        //   .where('texts.state', true)
        //   .groupBy('texts.author');
      });
    });

    // Gets a list of letters of authors, for generating a directory
    describe('getAuthorLetters(opts)', () => {
      it('returns all the author letters within a dat', () => {
        // const cacheKey = (opts.dat) ? opts.dat : 'all';
        // // return from cache
        // if (this.letters[cacheKey]) {
        //   return this.letters[cacheKey];
        // }
        // const exp = this.db.column(this.db.raw('lower(substr(author_sort,1,1)) as letter'))
        //   .select();
        // if (opts) {
        //   withinDat(exp, opts.dat);
        //   if (opts.collection) {
        //     withinColl(exp, opts.collection);
        //   }
        // }
        // return exp.from('texts')
        //   .where('texts.state', true)
        //   .distinct('letter')
        //   .orderBy('letter')
        //   .then((rows) => {
        //     // Put into cache & reduce non-characters to "etc."
        //     this.letters[cacheKey] = rows.map(doc => doc.letter).reduce((compressed, letter) => {
        //       if (theLetters.includes(letter)) return compressed.concat(letter);
        //       else if (!compressed.includes(otherLetters)) return compressed.concat(otherLetters);
        //       return compressed;
        //     }, []);
        //     return this.letters[cacheKey];
        //   });
      });
      it('caches the results', () => {

      });
    });

    describe('getTitlesForAuthor(author, opts)', () => {
      // it('returns all texts for a given author', () => {
      //   const exp = this.db('texts')
      //     .distinct('dat', 'title')
      //     .where('author', author)
      //     .andWhere('texts.state', true);
      //   if (opts) {
      //     withinDat(exp, opts.dat);
      //     if (opts.collection) {
      //       withinColl(exp, opts.collection);
      //     }
      //     applyRange(exp, opts);
      //     applySort(exp, opts, 'title', 'asc');
      //   }
      //   return exp;
      // });
    });

    describe('countTitlesWith(opts)', () => {
      // const exp = this.db
      //   .count('titles as num')
      //   .from(function() {
      //     this.distinct('dat', 'author', 'title', 'state').from('texts').as('texts');
      //   })
      //   .where('texts.state', true);
      // if (opts.author) {
      //   exp.where('texts.author', opts.author);
      // }
      // if (opts.title) {
      //   exp.where('texts.title', opts.title);
      // }
      // if (opts.collection) {
      //   withinColl(exp, opts.collection);
      // }
      // if (opts) withinDat(exp, opts.dat);
      // return exp
      //   .first()
      //   .then(rows => rows.num);
    });

    // Like getItemsWith, except some extra work is done to return titles
    // along with a comma-separated list of files:downloaded for each title.
    describe('getTitlesWith(opts)', () => {
      // const exp = this.db
      //   .select('texts.dat',
      //     'texts.author',
      //     'texts.title',
      //     'texts.title_hash',
      //     'texts.author_sort',
      //   this.db.raw(GROUP_CONCAT_FILES))
      //   .from('texts')
      //   .where('texts.state', true);
      // if (opts.author) {
      //   exp.where('texts.author', opts.author);
      // }
      // if (opts.title) {
      //   exp.where('texts.title', opts.title);
      // }
      // if (opts.collection) {
      //   withinColl(exp, opts.collection);
      // }
      // if (opts) withinDat(exp, opts.dat);
      // applyRange(exp, opts);
      // applySort(exp, opts, 'author_sort', 'asc');
      // return exp
      //   .groupBy('texts.author', 'texts.title');
    });

    // Gets entire entries for catalog items matching author/title/file.
    // Can specify a dat or a list of dats to get within.
    describe('getItemsWith(opts, distinct)', () => {
      // const exp = this.db('texts');
      // if (distinct) {
      //   exp.distinct(distinct);
      // }
      // if (opts.author) {
      //   exp.where('texts.author', opts.author);
      // }
      // if (opts.title) {
      //   exp.where('texts.title', opts.title);
      // }
      // if (opts.file) {
      //   exp.where('texts.file', opts.file);
      // }
      // if (opts.collection) {
      //   withinColl(exp, opts.collection);
      // }
      // withinDat(exp, opts.dat);
      // applyRange(exp, opts);
      // applySort(exp, opts, 'dat', 'asc');
      // return exp
      //   .where('texts.state', true);
    });

    // Optionally only include files from a particular dat.
    // Optionally specify a filename to find.
    describe('getFiles(author, title, opts)', () => {
      // const exp = this.db('texts')
      //   .where('author', author)
      //   .andWhere('title', title)
      //   .andWhere('texts.state', true);
      // if (opts) {
      //   withinDat(exp, opts.dat);
      //   exp.where('file', opts.file);
      // }
      // return exp.orderBy('dat', 'file');
    });

    describe('getDownloadCounts(dat)', () => {
      // const exp = this.db.select('texts.downloaded').from('texts')
      //   .count('texts.file as count');
      // withinDat(exp, dat);
      // return exp
      //   .where('texts.state', true)
      //   .groupBy('texts.downloaded')
      //   .orderBy('texts.downloaded', 'desc');
    });

    describe('getDats()', () => {
      // this.db('dats').select();
    });

    describe('getDat(key)', () => {
      // this.db('dats').select().where('dat', key);
    });
  });
});
