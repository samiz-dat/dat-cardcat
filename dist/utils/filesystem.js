'use strict';Object.defineProperty(exports, "__esModule", { value: true });exports.notADir = exports.getDirectories = undefined;exports.








lsFilesPromised = lsFilesPromised;var _fs = require('fs');var _fs2 = _interopRequireDefault(_fs);var _path = require('path');var _path2 = _interopRequireDefault(_path);var _bluebird = require('bluebird');var _bluebird2 = _interopRequireDefault(_bluebird);var _lodash = require('lodash');var _lodash2 = _interopRequireDefault(_lodash);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}const fs = _bluebird2.default.promisifyAll(_fs2.default); // Uses promises to recursively list a dat's contents using hyperdrive fs-ish functions
// Note that the Promised hyperdrive functions are passed in by the caller.
function lsFilesPromised(dir, readdirPromised, statPromised) {const readdirAsync = readdirPromised || fs.readdirAsync;const statAsync = statPromised || fs.statAsync;
  return readdirAsync(dir).
  map(file => {
    const rFile = _path2.default.join(dir, file);
    return statAsync(rFile).
    then(stat =>
    stat.isDirectory() ?
    lsFilesPromised(rFile, readdirAsync, statAsync) :
    rFile);

  }).
  then(results => _lodash2.default.flattenDeep(results));
}

const getDirectories = exports.getDirectories = srcpath => fs.readdirAsync(srcpath).
filter(file => fs.statSync(_path2.default.join(srcpath, file)).isDirectory());

// This is unusual, but I found that I cannot simply say !dirExists if dirExists returns a Promise.
// The promise always exists
const notADir = exports.notADir = srcpath =>
fs.statAsync(srcpath).
then(stat => !stat.isDirectory()).
catch(() => true);
//# sourceMappingURL=filesystem.js.map