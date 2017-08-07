import chai from 'chai';
import chaiThings from 'chai-things';
import chaiAsPromised from 'chai-as-promised';

import temp from 'temp';
import path from 'path';

import Database from '../src/db';
import config from '../src/knexfile';

chai.use(chaiThings);
chai.use(chaiAsPromised);

const expect = chai.expect;

const temporaryDir = './temp';

// commonOptions = {
//   dat: // limit by dat,
//   limit: // for pagination
//   offset:
//   sort: [], // args for ordering
// }

describe.only('database', () => {
  const datkeys = [
    '8008c72d90def12ea0ce908d2e8dd49083858f41f2569bf934b1ae064c7143f3',
    '8000000000000080000000000000800000000000008000000000000080000000',
  ];
  const texts = [{
    dat: '8008c72d90def12ea0ce908d2e8dd49083858f41f2569bf934b1ae064c7143f3',
    version: 1,
    state: false,
    title_hash: '?',
    file_hash: '?',
    author: 'Judith Butler',
    author_sort: 'Butler, Judith',
    title: 'Gender Trouble',
    file: 'gendertrouble.pdf',
    downloaded: false,
  }, {
    dat: '8008c72d90def12ea0ce908d2e8dd49083858f41f2569bf934b1ae064c7143f3',
    version: 2,
    state: false,
    title_hash: '?',
    file_hash: '?',
    author: 'Judith Butler',
    author_sort: 'Butler, Judith',
    title: 'Gender Trouble',
    file: 'gendertrouble.opf',
    downloaded: false,
  }, {
    dat: '8008c72d90def12ea0ce908d2e8dd49083858f41f2569bf934b1ae064c7143f3',
    version: 3,
    state: false,
    title_hash: '?',
    file_hash: '?',
    author: 'Judith Butler',
    author_sort: 'Butler, Judith',
    title: 'Gender Trouble',
    file: 'cover.jpg',
    downloaded: false,
  }, {
    dat: '8000000000000080000000000000800000000000008000000000000080000000',
    version: 1,
    state: false,
    title_hash: 'Democratic Paradox, The',
    file_hash: '?',
    author: 'Chantal Mouffe',
    author_sort: 'Mouffe, Chantal',
    title: 'The Democratic Paradox',
    file: 'democraticparadox.pdf',
    downloaded: false,
  }, {
    dat: '8000000000000080000000000000800000000000008000000000000080000000',
    version: 2,
    state: false,
    title_hash: 'Democratic Paradox, The',
    file_hash: '?',
    author: 'Chantal Mouffe',
    author_sort: 'Mouffe, Chantal',
    title: 'The Democratic Paradox',
    file: 'democraticparadox.opf',
    downloaded: false,
  }, {
    dat: '8000000000000080000000000000800000000000008000000000000080000000',
    version: 3,
    state: false,
    title_hash: 'Democratic Paradox, The',
    file_hash: '?',
    author: 'Chantal Mouffe',
    author_sort: 'Mouffe, Chantal',
    title: 'The Democratic Paradox',
    file: 'cover.jpg',
    downloaded: false,
  }];
  const datNotInDB = '8000000000000080000000000000800000000000008000000000000080000001';
  let database;

  const addDefaultDats = () => Promise.all(datkeys.map(key => database.addDat(key)));
  const addDefaultTexts = () => Promise.all(texts.map(text => database.db('texts').insert(text)));

  before(() => {
    temp.track();
    const tmpPath = temp.mkdirSync(temporaryDir);
    database = new Database(path.join(tmpPath, 'test.db'));
  });

  after(() => {
    temp.cleanupSync();
  });

  beforeEach(() => {
    return database.init();
  });
  afterEach(() => {
    return database.db.migrate.rollback(config.development.migration);
  });

  context('with simple data', () => {
    describe('.addDat(dat, name, dir, version, format)', () => {
      it('adds a dat to the db', () => {
        return database.addDat('8008c72d90def12ea0ce908d2e8dd49083858f41f2569bf934b1ae064c7143f3', 'test', '/here', 0, 'calibre')
          .then((result) => {
            expect(result).to.all.be.above(0);
          });
      });
      it('can add the same dat twice', () => {
        return database.addDat('8008c72d90def12ea0ce908d2e8dd49083858f41f2569bf934b1ae064c7143f3', 'test', '/here', 0)
          .then((result) => {
            expect(result).to.all.be.above(0);
          });
      });

      it('should not be able to add dat without at least specifing a valid key', () => {
        return expect(database.addDat()).to.be.rejected;
      });

      it('should not be able to add dat without at least specifing a valid key', () => {
        return expect(database.addDat('not a real key')).to.be.rejected;
      });
    });

    describe('getDats()', () => {
      beforeEach(addDefaultDats);

      it('should return all dat’s in the database', () => {
        return database.getDats().then((result) => {
          expect(result).to.have.length(2);
          datkeys.forEach(key => expect(result).to.contain.a.thing.with.property('dat', key));
        });
      });
    });

    describe('getDat(key)', () => {
      beforeEach(addDefaultDats);

      it('returns the dat with the matching key', () => {
        return Promise.all(datkeys.map(key => database.getDat(key).then((result) => {
          expect(result.dat).to.equal(key);
        })));
      });

      it('returns nothing if no key is found', () => {
        return database.getDat(datNotInDB)
          .then(r => expect(r).to.be.undefined);
      });

      it('does not care if the dat key is valid', () => {
        return database.getDat('not a valid key')
          .then(r => expect(r).to.be.undefined);
      });
    });

    describe('.removeDat(key)', () => {
      beforeEach(addDefaultDats);

      it('removes a dat with the specified key from the db', () => {
        return database.removeDat(datkeys[0])
          .then((result) => {
            expect(result).to.equal(1);
            return database.getDats();
          })
          .then((result) => {
            expect(result).to.have.length(datkeys.length - 1);
            expect(result).to.not.contain.a.thing.with.property('dat', datkeys[0]);
          });
      });

      it('does not remove anything if provided dat key is not found', () => {
        return database.removeDat(datNotInDB)
          .then((result) => {
            expect(result).to.equal(0);
            return database.getDats();
          })
          .then((result) => {
            expect(result).to.have.length(datkeys.length);
            expect(result).to.not.contain.a.thing.with.property('dat', datNotInDB);
          });
      });

      it('throws an error if no dat is specified', () => {
        return expect(database.removeDat()).to.be.rejected;
      });
    });

    describe('.updateDat(datKey, opts)', () => {
      beforeEach(addDefaultDats);

      it('updates dat in db with specific key and with options passed', () => {
        const newValues = {
          name: 'newName',
          version: 1,
          format: 'mono',
          dir: '/some/path',
        };
        return database.updateDat(datkeys[0], newValues)
          .then((result) => {
            expect(result).to.equal(1);
            return database.getDat(datkeys[0]);
          })
          .then((result) => {
            expect(result).to.have.include(newValues);
          });
      });
      it('is rejected if no key is provided', () => {
        return expect(database.updateDat()).be.rejected;
      });
      it('is rejected if no dat is found for that key', () => {
        return expect(database.updateDat(datNotInDB, {})).be.rejected;
      });
      it('is rejected if no options are passed', () => {
        return Promise.all([
          expect(database.updateDat(datkeys[0], {})).be.rejected,
          expect(database.updateDat(datkeys[0], { noInTable: 'this' })).be.rejected,
          expect(database.updateDat(datkeys[0], { noInTable: 'this', name: 'ok' })).be.rejected,
        ]);
      });
    });

    describe('clearTexts(datKey)', () => {
      beforeEach(addDefaultTexts);
      it('clears all texts from db', () => {
        return database.clearTexts()
          .then((result) => {
            expect(result).to.equal(6);
            return database.db('texts').select();
          })
          .then((result) => {
            expect(result).to.have.length(0);
          });
      });
      it('clears all texts from only specified dat', () => {
        return database.clearTexts(datkeys[0])
          .then((result) => {
            expect(result).to.equal(3);
            return database.db('texts').select();
          })
          .then((result) => {
            expect(result).to.have.length(3);
          });
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
  });

  context('when complete metadata has been downloaded for texts', () => {
    //include tests for what we are expecting
  });
});
