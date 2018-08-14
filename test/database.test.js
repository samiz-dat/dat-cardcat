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

describe('database', () => {
  const datkeys = [
    '8008c72d90def12ea0ce908d2e8dd49083858f41f2569bf934b1ae064c7143f3',
    '8000000000000080000000000000800000000000008000000000000080000000',
  ];
  const texts = [{
    dat: '8008c72d90def12ea0ce908d2e8dd49083858f41f2569bf934b1ae064c7143f3',
    version: 1,
    status: -1,
    author: 'Judith Butler',
    author_sort: 'Butler, Judith',
    title: 'Gender Trouble',
    path: 'Judith Butler/Gender Trouble/gendertrouble.pdf',
  }, {
    dat: '8008c72d90def12ea0ce908d2e8dd49083858f41f2569bf934b1ae064c7143f3',
    version: 2,
    status: -1,
    author: 'Judith Butler',
    author_sort: 'Butler, Judith',
    title: 'Gender Trouble',
    path: 'Judith Butler/Gender Trouble/gendertrouble.pdf',
  }, {
    dat: '8008c72d90def12ea0ce908d2e8dd49083858f41f2569bf934b1ae064c7143f3',
    version: 3,
    status: 1,
    author: 'Judith Butler',
    author_sort: 'Butler, Judith',
    title: 'Gender Trouble',
    path: 'Judith Butler/Gender Trouble/cover.jpg',
  }, {
    dat: '8000000000000080000000000000800000000000008000000000000080000000',
    version: 1,
    status: -1,
    title_sort: 'Democratic Paradox, The',
    author: 'Chantal Mouffe',
    author_sort: 'Mouffe, Chantal',
    title: 'The Democratic Paradox',
    path: 'Chantal Mouffe/The Democratic Paradox/democraticparadox.pdf',
  }, {
    dat: '8000000000000080000000000000800000000000008000000000000080000000',
    version: 2,
    status: -1,
    title_sort: 'Democratic Paradox, The',
    author: 'Chantal Mouffe',
    author_sort: 'Mouffe, Chantal',
    title: 'The Democratic Paradox',
    path: 'Chantal Mouffe/The Democratic Paradox/democraticparadox.pdf',
  }, {
    dat: '8000000000000080000000000000800000000000008000000000000080000000',
    version: 3,
    status: 0,
    title_sort: 'Democratic Paradox, The',
    author: 'Chantal Mouffe',
    author_sort: 'Mouffe, Chantal',
    title: 'The Democratic Paradox',
    path: 'Chantal Mouffe/The Democratic Paradox/cover.jpg',
  }, {
    dat: '8000000000000080000000000000800000000000008000000000000080000000',
    version: 4,
    status: 1,
    title_sort: 'Hegemony and Socialist Strategy',
    authors: [
      { author: 'Ernesto Laclau', author_sort: 'Laclau, Ernesto' },
      { author: 'Chantal Mouffe', author_sort: 'Mouffe, Chantal' },
    ],
    author_sort: 'Laclau, Ernesto',
    title: 'Hegemony and Socialist Strategy',
    path: 'Ernesto Laclau and Chantal Mouffe/Hegemony and Socialist Strategy/Hegemony and Socialist Strategy.pdf',
  }, {
    dat: '8000000000000080000000000000800000000000008000000000000080000000',
    version: 4,
    status: 1,
    title_sort: 'Hegemony and Socialist Strategy',
    authors: [
      { author: 'Ernesto Laclau', author_sort: 'Laclau, Ernesto' },
      { author: 'Chantal Mouffe', author_sort: 'Mouffe, Chantal' },
    ],
    author_sort: 'Laclau, Ernesto',
    title: 'Hegemony and Socialist Strategy',
    path: 'Ernesto Laclau and Chantal Mouffe/Hegemony and Socialist Strategy/cover.jpg',
  }];
  const datNotInDB = '8000000000000080000000000000800000000000008000000000000080000001';
  let database;

  const addDefaultDats = () => Promise.all(datkeys.map(key => database.addDat(key)));
  async function addDefaultTexts() {
    for (const text of texts) {
      await database.addTextFromMetadata(text);
    }
  }

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

      it('should return all dats in the database', () => {
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
      beforeEach(addDefaultDats);
      beforeEach(addDefaultTexts);
      it('clears all texts from db', () => {
        return database.clearTexts()
          .then((result) => {
            expect(result).to.equal(6);
            return database.db('files').select();
          })
          .then((result) => {
            expect(result).to.have.length(0);
          });
      });
      it('clears all texts from only specified dat', () => {
        return database.clearTexts(datkeys[0])
          .then((result) => {
            expect(result).to.equal(2);
            return database.db('files').select();
          })
          .then((result) => {
            expect(result).to.have.length(4);
            return database.db('titles').select();
          });
      });
      it('clears all titles from only specified dat', () => {
        return database.clearTexts(datkeys[0])
          .then(() => {
            return database.db('titles').select();
          })
          .then((result) => {
            expect(result).to.have.length(2);
          });
      });
      it('clears all authors from only specified dat', () => {
        return database.clearTexts(datkeys[0])
          .then(() => {
            return database.db('authors').select();
          })
          .then((result) => {
            expect(result).to.have.length(2);
          });
      });
    });

    describe('lastImportedVersion(datKey)', () => {
      beforeEach(addDefaultDats);
      beforeEach(addDefaultTexts);
      it('returns the maximium version of a file imported from a specific dat', () => {
        return database.lastImportedVersion(datkeys[0])
          .then((result) => {
            expect(result).to.equal(3);
          });
      });
      it('throws an error if no dat key is provided', () => {
        return expect(database.lastImportedVersion()).be.rejected;
      });
    });

    describe('addTextFromMetadata(opts)', () => {
      // @TODO: Not sure what to do for these test
      beforeEach(addDefaultDats);
      it('sanitizes path names that include the separator characters', async () => {
        const data = {
          dat: datkeys[0],
          version: 1,
          status: 1,
          author: 'Karl Marx',
          author_sort: 'Marx, Karl',
          title: 'Capital',
          path: 'Karl Marx/Capital/Capital:-Volume I;;-The-Process-of-Production-of-Capital.pdf',
        };
        await database.addTextFromMetadata(data);
        const file = await database.db('files').select().first();
        expect(file.path).to.equal('Karl Marx/Capital/Capital%3A-Volume I%3B%3B-The-Process-of-Production-of-Capital.pdf');
        const files = await database.getFilesWith({ author: 'Karl Marx' });
        expect(files[0].path).to.equal(data.path);
      });
    });

    // Sets download status of a row
    describe('setDownloaded(dat, file, downloaded = true)', () => {
      beforeEach(addDefaultDats);
      beforeEach(addDefaultTexts);

      it('sets the download status of a file', () => {
        return database.setDownloaded(datkeys[1], 'Chantal Mouffe/The Democratic Paradox/cover.jpg')
          .then(() => database.getDownloadCounts())
          .then((result) => {
            expect(result).to.have.property('1');
            expect(result[1]).to.equal(4);
          });
      });

      it('unsets the download status of a file', () => {
        return database.setDownloaded(datkeys[1], 'Ernesto Laclau and Chantal Mouffe/Hegemony and Socialist Strategy/cover.jpg', false)
          .then(() => database.getDownloadCounts())
          .then((result) => {
            expect(result).to.have.property('1');
            expect(result[1]).to.equal(2);
          });
      });
    });

    describe('countSearch(query, opts)', () => {
      beforeEach(addDefaultDats);
      beforeEach(addDefaultTexts);

      it('returns the number of items for a search', () => {
        return database.countSearch('Gender')
          .then((result) => {
            expect(result).to.equal(1);
          });
      });

      it('returns the number of items for searching author names', () => {
        return database.countSearch('mouffe')
          .then((result) => {
            expect(result).to.equal(2);
          });
      });

      it('returns the number of items for searching in a dat', () => {
        return database.countSearch('gender', { dat: datkeys[0] })
          .then((result) => {
            expect(result).to.equal(1);
          });
      });

      it('returns the number of items for searching in the wrong dat', () => {
        return database.countSearch('mouffe', { dat: datkeys[0] })
          .then((result) => {
            expect(result).to.equal(0);
          });
      });
    });

    describe('search(query, opts)', () => {
      beforeEach(addDefaultDats);
      beforeEach(addDefaultTexts);

      it('returns search results for a query on titles', () => {
        return database.search('Gender')
          .then((result) => {
            expect(result).to.have.length(1);
          });
      });

      it('searching is not case-sensitive', () => {
        return database.search('gender')
          .then((result) => {
            expect(result).to.have.length(1);
          });
      });

      it('searching author names also works', () => {
        return database.search('mouffe')
          .then((result) => {
            expect(result).to.have.length(2);
          });
      });

      it('searching in a dat', () => {
        return database.search('gender', { dat: datkeys[0] })
          .then((result) => {
            expect(result).to.have.length(1);
          });
      });

      it('searching in the wrong dat returns no results', () => {
        return database.search('mouffe', { dat: datkeys[0] })
          .then((result) => {
            expect(result).to.have.length(0);
          });
      });
    });

    // Gets a count of authors in the catalog
    describe('countAuthors(startingWith, opts)', () => {
      beforeEach(addDefaultDats);
      beforeEach(addDefaultTexts);

      it('returns a count of authors', () => {
        return database.countAuthors()
          .then((result) => {
            expect(result).to.equal(3);
          });
      });
      it('counts all authors starting with "L"', () => {
        return database.countAuthors('l')
          .then((result) => {
            expect(result).to.equal(1);
          });
      });
      it('counts all authors in a dat', () => {
        return database.countAuthors(false, { dat: datkeys[1] })
          .then((result) => {
            expect(result).to.equal(2);
          });
      });
      it('counts all authors starting with "L" in a dat with no such authors', () => {
        return database.countAuthors('l', { dat: datkeys[0] })
          .then((result) => {
            expect(result).to.equal(0);
          });
      });
    });

    // Gets authors in the catalog
    describe('getAuthors(startingWith, opts)', () => {
      beforeEach(addDefaultDats);
      beforeEach(addDefaultTexts);

      it('gets all authors in catalog', () => {
        return database.getAuthors()
          .then((result) => {
            expect(result).to.have.length(3);
          });
      });
      it('gets all authors starting with "L"', () => {
        return database.getAuthors('l')
          .then((result) => {
            expect(result).to.have.length(1);
          });
      });
      it('gets number of texts for "Mouffe"', () => {
        return database.getAuthors('mouffe')
          .first()
          .then((result) => {
            expect(result.count).to.equal(2);
          });
      });
      it('gets all authors in a dat', () => {
        return database.getAuthors(false, { dat: datkeys[0] })
          .then((result) => {
            expect(result).to.have.length(1);
          });
      });
      it('gets all authors starting with "L" in a dat with no such authors', () => {
        return database.getAuthors('l', { dat: datkeys[0] })
          .then((result) => {
            expect(result).to.have.length(0);
          });
      });
    });

    // Gets a list of letters of authors, for generating a directory
    describe('getAuthorLetters(opts)', () => {
      beforeEach(addDefaultDats);
      beforeEach(addDefaultTexts);

      it('returns all the author letters', () => {
        return database.getAuthorLetters({})
          .then((result) => {
            expect(result).to.have.length(3);
          });
      });
      it('returns all the author letters within a dat', () => {
        return database.getAuthorLetters({ dat: datkeys[0] })
          .then((result) => {
            expect(result).to.have.length(1);
          });
      });
      it('caches the results', () => {
        return database.getAuthorLetters({ dat: datkeys[0] })
          .then((result) => {
            expect(result).to.have.length(1);
          });
      });
    });

    describe('countTitlesWith(opts)', () => {
      beforeEach(addDefaultDats);
      beforeEach(addDefaultTexts);

      it('counts all the titles', () => {
        return database.countTitlesWith({})
          .then((result) => {
            expect(result).to.equal(3);
          });
      });

      it('counts all the titles for an author with multiple titles', () => {
        return database.countTitlesWith({ author: 'Chantal Mouffe' })
          .then((result) => {
            expect(result).to.equal(2);
          });
      });

      it('counts 1 for an author with one title', () => {
        return database.countTitlesWith({ author: 'Judith Butler' })
          .then((result) => {
            expect(result).to.equal(1);
          });
      });

      it('counts 0 for an author with no titles', () => {
        return database.countTitlesWith({ author: 'Gilles Deleuze' })
          .then((result) => {
            expect(result).to.equal(0);
          });
      });

      it('counts a title by name', () => {
        return database.countTitlesWith({ title: 'Hegemony and Socialist Strategy' })
          .then((result) => {
            expect(result).to.equal(1);
          });
      });

      it('return 0 for a bad combination', () => {
        return database.countTitlesWith({ author: 'Gilles Deleuze', title: 'Hegemony and Socialist Strategy' })
          .then((result) => {
            expect(result).to.equal(0);
          });
      });

      it('counts all the titles in a dat', () => {
        return database.countTitlesWith({ dat: datkeys[0] })
          .then((result) => {
            expect(result).to.equal(1);
          });
      });
    });

    // Like getItemsWith, except some extra work is done to return titles
    // along with a comma-separated list of files:downloaded for each title.
    describe('getTitlesWith(opts)', () => {
      beforeEach(addDefaultDats);
      beforeEach(addDefaultTexts);

      it('returns all the titles', () => {
        return database.getTitlesWith({})
          .then((result) => {
            expect(result).to.have.length(3);
          });
      });

      it('returns all the titles for an author with multiple titles', () => {
        return database.getTitlesWith({ author: 'Chantal Mouffe' })
          .then((result) => {
            expect(result).to.have.length(2);
          });
      });

      it('returns all the titles for an author with one title', () => {
        return database.getTitlesWith({ author: 'Judith Butler' })
          .then((result) => {
            expect(result).to.have.length(1);
          });
      });

      it('returns all the titles for an author with no titles', () => {
        return database.getTitlesWith({ author: 'Gilles Deleuze' })
          .then((result) => {
            expect(result).to.have.length(0);
          });
      });

      it('returns a title by name', () => {
        return database.getTitlesWith({ title: 'Hegemony and Socialist Strategy' })
          .then((result) => {
            expect(result).to.have.length(1);
          });
      });

      it('fails to return any titles for a bad combination', () => {
        return database.getTitlesWith({ author: 'Gilles Deleuze', title: 'Hegemony and Socialist Strategy' })
          .then((result) => {
            expect(result).to.have.length(0);
          });
      });

      it('returns all the titles in a dat', () => {
        return database.getTitlesWith({ dat: datkeys[0] })
          .then((result) => {
            expect(result).to.have.length(1);
          });
      });

      it('returns the correct number of files', () => {
        return database.getTitlesWith({ title: 'Hegemony and Socialist Strategy' })
          .then((result) => {
            expect(result[0].files).to.have.length(2);
          });
      });

      it('returns the correct number of authors', () => {
        return database.getTitlesWith({ title: 'Hegemony and Socialist Strategy' })
          .then((result) => {
            expect(result[0].authors).to.have.length(2);
          });
      });

      it('returns multiple authors in the correct order', () => {
        return database.getTitlesWith({ title: 'Hegemony and Socialist Strategy' })
          .then((result) => {
            expect(result[0].author).to.equal('Ernesto Laclau; Chantal Mouffe');
          });
      });
    });

    // Gets entire entries for catalog items matching author/title/file.
    // Can specify a dat or a list of dats to get within.
    describe('getFilesWith(opts, distinct)', () => {
      beforeEach(addDefaultDats);
      beforeEach(addDefaultTexts);

      it('returns all the files', () => {
        return database.getFilesWith({})
          .then((result) => {
            expect(result).to.have.length(4);
          });
      });

      it('returns all the required fields', () => {
        return database.getFilesWith({})
          .then((result) => {
            expect(result[0]).to.have.property('dat');
            expect(result[0]).to.have.property('path');
            expect(result[0]).to.have.property('id');
          });
      });

      it('returns all the files for an author with multiple titles', () => {
        return database.getFilesWith({ author: 'Chantal Mouffe' })
          .then((result) => {
            expect(result).to.have.length(3);
          });
      });

      it('returns all the files for an author with one title', () => {
        return database.getFilesWith({ author: 'Judith Butler' })
          .then((result) => {
            expect(result).to.have.length(1);
          });
      });

      it('returns all the files for an author with no titles', () => {
        return database.getFilesWith({ author: 'Gilles Deleuze' })
          .then((result) => {
            expect(result).to.have.length(0);
          });
      });

      it('returns all files for a title name', () => {
        return database.getFilesWith({ title: 'Hegemony and Socialist Strategy' })
          .then((result) => {
            expect(result).to.have.length(2);
          });
      });

      it('fails to return any files for a bad combination', () => {
        return database.getFilesWith({ author: 'Gilles Deleuze', title: 'Hegemony and Socialist Strategy' })
          .then((result) => {
            expect(result).to.have.length(0);
          });
      });

      it('returns all the files in a dat', () => {
        return database.getFilesWith({ dat: datkeys[0] })
          .then((result) => {
            expect(result).to.have.length(1);
          });
      });
    });

    describe('getDownloadCounts(dat)', () => {
      beforeEach(addDefaultDats);
      beforeEach(addDefaultTexts);

      it('gets total download counts', () => {
        return database.getDownloadCounts()
          .then((result) => {
            expect(result).to.have.property('0');
            expect(result).to.have.property('1');
            expect(result[0]).to.equal(1);
            expect(result[1]).to.equal(3);
          });
      });
      it('gets download counts within a dat', () => {
        return database.getDownloadCounts(datkeys[0])
          .then((result) => {
            expect(result).to.not.have.property('0');
            expect(result).to.have.property('1');
            expect(result[1]).to.equal(1);
          });
      });
    });
  });

  context('when complete metadata has been downloaded for texts', () => {
    it('will definitely be tested');
  });
});
