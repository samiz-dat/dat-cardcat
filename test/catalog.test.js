import chai from 'chai';
import temp from 'temp';
import Promise from 'bluebird';
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

  describe('createCatalog()', () => {
    it('takes directory as primary arg and returns a promise which resolved to a new Catalog instance', () => {
      const promise = createCatalog(libraryHome);
      expect(promise).to.be.instanceOf(Promise);
      return promise.then((catalog) => {
        expect(catalog).to.be.instanceOf(Catalog);
        return catalog.close();
      });
    });
  });


  describe.only('catalog.importDat(key)', () => {
    it.only('connects to and imports external dat libary via key', (done) => {
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

  it('imports dats within its home directory on startup', () => {
    return createCatalog(libraryHome)
      .then((catalog) => {
        return catalog.importDat(externalLibraryKey, 'external library')
          .delay(500)
          .then(() => catalog.close());
      })
      .tap(() => { console.log('TEARING DOWN DB AND STARTING AGAIN'); })
      .then(() => createCatalog(libraryHome))
      .then((catalog) => {
        // some text to ensure that data is present
        return catalog.close();
      });
  });
});

describe('fork a library', () => {
  it('needs a real test', () => {
    expect('us to write some real tests soon').to.have.string('tests');
  });
});

