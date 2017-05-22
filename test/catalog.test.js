import chai from 'chai';
import path from 'path';
import rimraf from 'rimraf';
import Dat from 'dat-node';

const expect = chai.expect;

const libraryDat = path.join(__dirname, 'fixtures', 'calibre-library');

function shareLibraryDat(opts = {}, cb) {
  const callback = (typeof opts === 'function') ? opts : cb;

  rimraf.sync(path.join(libraryDat, '.dat')); // for previous failed tests
  Dat(libraryDat, { temp: true }, (err, dat) => {
    if (err) {
      callback(err);
    } else {
      dat.joinNetwork({ dht: false });
      dat.importFiles((error) => {
        if (error) callback(error);
        else callback(null, dat.key.toString('hex'), closeCb => dat.close(closeCb));
      });
    }
  });
}

describe('catalog class', () => {
  let close;
  let externalLibraryKey;

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

  it('connect to an import external dat libary', () => {
    expect(externalLibraryKey).to.be.a('string');
  });
});

describe('fork a library', () => {
  it('needs a real test', () => {
    expect('us to write some real tests soon').to.have.string('tests');
  });
});

