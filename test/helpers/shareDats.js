import path from 'path';
import rimraf from 'rimraf';
import Dat from 'dat-node';

const fixturePath = path.resolve(__dirname, '../fixtures');
const libraryDat = path.join(fixturePath, 'calibre-library');
const nonLibraryDat = path.join(fixturePath, 'not-a-library');

function shareDat(name, opts = {}, cb) {
  const callback = (typeof opts === 'function') ? opts : cb;

  rimraf.sync(path.join(name, '.dat')); // for previous failed tests
  Dat(name, { temp: true }, (err, dat) => {
    if (err) {
      callback(err);
    } else {
      dat.joinNetwork();
      dat.importFiles((error) => {
        if (error) callback(error);
        else callback(null, dat.key.toString('hex'), closeCb => dat.close(closeCb));
      });
    }
  });
}

export const shareLibraryDat = (opts, cb) => shareDat(libraryDat, opts, cb);
export const shareNonLibraryDat = (opts, cb) => shareDat(nonLibraryDat, opts, cb);
