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

  it('connects to an import external dat libary', () => {
    return createCatalog(libraryHome)
      .then((catalog) => {
        expect(catalog).to.be.instanceOf(Catalog);
        expect(externalLibraryKey).to.be.a('string');
        return catalog.importDat(externalLibraryKey, 'external library')
          .delay(500)
          .then(() => catalog.close());
      });
  });

  it.only('imports dats within its home directory on startup', () => {
    return createCatalog(libraryHome)
      .then((catalog) => {
        expect(catalog).to.be.instanceOf(Catalog);
        expect(externalLibraryKey).to.be.a('string');
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

