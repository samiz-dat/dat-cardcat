import chai from 'chai';
import temp from 'temp';

import { shareLibraryDat } from './helpers/shareDats';

import { Catalog, createCatalog } from '../src/catalog';

const expect = chai.expect;

describe('catalog class', () => {
  let close;
  let externalLibraryKey;
  let libraryHome;

  // set up temporary dat for testing
  before((done) => {
    temp.track();
    libraryHome = temp.mkdirSync('./temporaryDir');
    shareLibraryDat((err, shareKey, closeShare) => {
      close = closeShare;
      externalLibraryKey = shareKey;
      done(err);
    });
  });

  // close temporary dat after tests
  after((done) => {
    temp.cleanupSync();
    close(done);
  });

  it('connects to an import external dat libary', () => {
    return createCatalog(libraryHome)
      .then((catalog) => {
        expect(catalog).to.be.instanceOf(Catalog);
        expect(externalLibraryKey).to.be.a('string');
        return catalog.importDat(externalLibraryKey, 'external library')
          .delay(500);
      });
  });
});

describe('fork a library', () => {
  it('needs a real test', () => {
    expect('us to write some real tests soon').to.have.string('tests');
  });
});

