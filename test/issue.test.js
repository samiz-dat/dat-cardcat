// import chai from 'chai';
import temp from 'temp';
import createDat from 'dat-node';
import Promise from 'bluebird';
import { shareLibraryDat } from './helpers/shareDats';

const createDatAsync = Promise.promisify(createDat);
const temporaryDir = './temp';

describe('replicate issue with dat.close', () => {
  let close;
  let externalLibraryKey;

  before((done) => {
    temp.track();
    shareLibraryDat((err, shareKey, closeShare) => {
      close = closeShare;
      externalLibraryKey = shareKey;
      done(err);
    });
  });
  after((done) => {
    temp.cleanupSync();
    close(done);
  });

  it('breaks', () => {
    const opts = {
      latest: true,
      indexing: true,
    };
    const tmpPath = temp.mkdirSync(temporaryDir);
    return createDatAsync(tmpPath, opts)
      .then((dat) => {
        const importOpts = {
          key: externalLibraryKey,
          watch: true,
          count: true,
          dereference: true,
          indexing: true,
        };
        dat.importFiles(importOpts, () => {
          console.log('finished importing');
        });
        return new Promise(resolve => dat.close(resolve));
      });
  });
});
