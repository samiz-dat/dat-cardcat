import chai from 'chai';
import temp from 'temp';
import path from 'path';
import fs from 'fs';
import Promise from 'bluebird';
import mirror from 'mirror-folder';
import { shareLibraryDat } from './helpers/shareDats';

import { Catalog, createCatalog } from '../src/catalog';

const expect = chai.expect;

describe('catalog class', function () {
  this.timeout(15000);
  let close;
  let externalLibraryKey;
  let libraryHome;

  // set up temporary dat for testing
  before((done) => {
    shareLibraryDat((err, shareKey, closeShare) => {
      close = closeShare;
      externalLibraryKey = shareKey;
      done(err);
    });
  });

  // close temporary dat after tests
  after((done) => {
    close(done);
  });

  beforeEach((done) => {
    temp.track();
    libraryHome = temp.mkdirSync('./temporaryDir');
    done();
  });

  afterEach((done) => {
    temp.cleanupSync();
    done();
  });

  describe('constructor functions createCatalog() and .init()', () => {
    it('createCatalog() takes directory as primary arg and returns a promise which resolved to a new Catalog instance', () => {
      const promise = createCatalog(libraryHome);
      expect(promise).to.be.instanceOf(Promise);
      return promise.then((catalog) => {
        expect(catalog).to.be.instanceOf(Catalog);
        return catalog.close();
      });
    });

    it('imports dats within its home directory on startup', (done) => {
      createCatalog(libraryHome)
        .then((catalog) => {
          return new Promise((resolve, reject) => {
            catalog.importDat(externalLibraryKey, 'external library');
            catalog.on('import', (data) => {
              if (data.dat === externalLibraryKey && data.progress === 100) {
                catalog.close();
              }
            });
            catalog.on('closed', resolve);
            catalog.on('error', reject);
          });
        })
        .then(() => {
          console.log('TEARING DOWN LIBRARY AND STARTING AGAIN');
          fs.unlinkSync(path.join(libraryHome, 'catalog.db'));
          const catalog = new Catalog(libraryHome);
          let importCount = 0;
          let previousProgress;
          catalog.on('import', (data) => {
            if (data.dat === externalLibraryKey) {
              importCount++;
              if (previousProgress) expect(data.progress).to.be.above(previousProgress);
              if (data.progress === 100) catalog.close();
            }
          });
          catalog.on('closed', () => {
            expect(importCount).to.eql(10);
            done();
          });
          catalog.on('error', done);
          return catalog.init();
        }).catch(done);
    });

    it('it attempts to make roots folders in the library dir that are not dats into dats', (done) => {
      mirror(path.join(__dirname, 'fixtures', 'calibre-library'), path.join(libraryHome, 'not-a-dat'), (err) => {
        if (err) return done(err);
        return createCatalog(libraryHome)
          .then((catalog) => {
            catalog.close()
              .then(done);
          });
      });
    });
  });


  describe('catalog.importDat(key)', () => {
    it('connects to and imports external dat libary via key', (done) => {
      createCatalog(libraryHome)
        .then((catalog) => {
          expect(externalLibraryKey).to.be.a('string');
          let importCount = 0;
          let previousProgress;
          catalog.on('import', (data) => {
            if (data.dat === externalLibraryKey) {
              importCount++;
              if (previousProgress) expect(data.progress).to.be.above(previousProgress);
              if (data.progress === 100) catalog.close();
            }
          });
          catalog.on('closed', () => {
            expect(importCount).to.eql(10);
            done();
          });
          catalog.on('error', done);
          return catalog.importDat(externalLibraryKey, 'external library');
        });
    });
  });
});

describe('fork a library', () => {
  it('needs a real test', () => {
    expect('us to write some real tests soon').to.have.string('tests');
  });
});

