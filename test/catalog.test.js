import chai from 'chai';
import { shareLibraryDat } from './helpers/shareDats';

const expect = chai.expect;

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

  it('connects to an import external dat libary', () => {
    expect(externalLibraryKey).to.be.a('string');
  });
});

describe('fork a library', () => {
  it('needs a real test', () => {
    expect('us to write some real tests soon').to.have.string('tests');
  });
});

