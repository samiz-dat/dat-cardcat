'use strict';Object.defineProperty(exports, "__esModule", { value: true });exports.notADir = exports.getDirectories = undefined;var _fs = require('fs');var _fs2 = _interopRequireDefault(_fs);
var _path = require('path');var _path2 = _interopRequireDefault(_path);
var _bluebird = require('bluebird');var _bluebird2 = _interopRequireDefault(_bluebird);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}

const fs = _bluebird2.default.promisifyAll(_fs2.default);


const getDirectories = exports.getDirectories = srcpath => fs.readdirAsync(srcpath) // eslint-disable-line
.filter(file => fs.statSync(_path2.default.join(srcpath, file)).isDirectory());

// This is unusual, but I found that I cannot simply say !dirExists if dirExists returns a Promise.
// The promise always exists
const notADir = exports.notADir = srcpath =>
fs.statAsync(srcpath).
then(stat => !stat.isDirectory()).
catch(() => true);
//# sourceMappingURL=filesystem.js.map