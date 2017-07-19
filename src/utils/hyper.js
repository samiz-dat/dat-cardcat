// Helping with hyperdrive/ hypercore, trying to pull code out of DatWrapper
import Promise from 'bluebird';
import maybe from 'call-me-maybe';
import co from 'co';
import path from 'path';

function normalize(rootPath, parentPath, subname) {
  const str = path.join(parentPath, subname).slice(rootPath.length);
  if (str.charAt(0) === '/') return str.slice(1);
  return str;
}

// From pauls-dat-api: lookup information about a file
export function stat(archive, name, cb) {
  return maybe(cb, new Promise((resolve, reject) => {
    // run stat operation
    archive.stat(name, (err, st) => {
      if (err) reject(err);
      else {
        // read download status
        st.downloaded = 0;
        if (archive.isStaging) {
          st.downloaded = st.blocks;
        } else if (archive.content && archive.content.length) {
          st.downloaded = archive.content.downloaded(st.offset, st.offset + st.blocks);
        }
        resolve(st);
      }
    });
  }));
}

// helper to list the files in a directory
export function readdir(archive, name, fOpts, fCb) {
  const cb = (typeof fOpts === 'function') ? fOpts : fCb;
  let opts = (typeof fOpts === 'function') ? {} : fOpts;

  opts = opts || {};

  return maybe(cb, co(function* () {
    // options
    const recursive = (opts && !!opts.recursive);

    // run first readdir
    const promise = new Promise((resolve, reject) => {
      archive.readdir(name, (err, names) => {
        if (err) reject(err);
        else resolve(names);
      });
    });
    let results = yield promise;

    // recurse if requested
    if (recursive) {
      const rootPath = name;
      const readdirSafe = n => new Promise((resolve) => {
        archive.readdir(n, (_, names) => resolve(names || []));
      });
      const recurse = co.wrap(function* (names, parentPath) {
        yield Promise.all(names.map(co.wrap(function* (n) {
          const thisPath = path.join(parentPath, n);
          const subnames = yield readdirSafe(thisPath);
          yield recurse(subnames, thisPath);
          results = results.concat(subnames.map(subname => normalize(rootPath, thisPath, subname)));
        })));
      });
      yield recurse(results, name);
    }
    return results;
  }));
}

// download the given file(s)
export function download(archive, name, cb) {
  return maybe(cb, co(function* () {
    // lookup the entry
    const entry = yield stat(archive, name);
    if (!entry) {
      throw new Error(`The entry ${name} was not found in the archive.`);
    }

    // recurse on a directory
    if (entry.isDirectory()) {
      const listing = yield readdir(archive, name);
      const promises = listing.map(subname => download(archive, path.join(name, subname)));
      return Promise.all(promises);
    }

    // prioritize a file
    if (entry.isFile()) {
      return new Promise((resolve, reject) => {
        archive.content.download({
          start: entry.offset,
          end: entry.offset + entry.blocks,
        }, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }));
}
