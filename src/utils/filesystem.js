import fsOrig from 'fs';
import path from 'path';
import Promise from 'bluebird';
import _ from 'lodash';

const fs = Promise.promisifyAll(fsOrig);

// Uses promises to recursively list a dat's contents using hyperdrive fs-ish functions
// Note that the Promised hyperdrive functions are passed in by the caller.
export function lsFilesPromised(dir, readdirPromised, statPromised) {
  const readdirAsync = readdirPromised || fs.readdirAsync;
  const statAsync = statPromised || fs.statAsync;
  return readdirAsync(dir)
    .map((file) => {
      const rFile = path.join(dir, file);
      return statAsync(rFile)
        .then(stat => (
          stat.isDirectory()
          ? lsFilesPromised(rFile, readdirAsync, statAsync)
          : rFile
        ));
    })
    .then(results => _.flattenDeep(results));
}

export const getDirectories = srcpath => fs.readdirAsync(srcpath)
  .filter(file => fs.statSync(path.join(srcpath, file)).isDirectory());

// This is unusual, but I found that I cannot simply say !dirExists if dirExists returns a Promise.
// The promise always exists
export const notADir = srcpath =>
  fs.statAsync(srcpath)
    .then(stat => !stat.isDirectory())
    .catch(() => true);
