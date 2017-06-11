import path from 'path';
import ncp from 'ncp';
import Dat from '../../src/dat';


const fixturePath = path.resolve(__dirname, '../fixtures');
const libraryDat = 'calibre-library';
const nonLibraryDat = 'not-a-library';

function makeDat(name, dir, opts = {}, cb) {
  const from = path.join(fixturePath, name);
  const to = path.join(dir, name);
  const callback = (typeof opts === 'function') ? opts : cb;
  const options = (typeof opts !== 'function') ? { directory: to, ...opts } : { directory: to };
  // copy fixture into temporary directory
  ncp(from, to, (err) => {
    if (err) callback(err);
    callback(null, new Dat(options));
  });
}

export const makeLibraryDat = (dir, opts, cb) => makeDat(libraryDat, dir, opts, cb);
export const makeNonLibraryDat = (dir, opts, cb) => makeDat(nonLibraryDat, dir, opts, cb);
