'use strict';Object.defineProperty(exports, "__esModule", { value: true });exports.default =





























function (entry, format = 'calibre') {
  // Only files (not directories) are eligible
  if (entry.type === 'file') {
    const arr = entry.name.split(_path2.default.sep);
    // Sometimes there is a leading slash which messes things up
    if (arr[0] === '') {
      arr.shift();
    }
    // Call the appropriate parser for the given format
    return parsers[format](arr);
  }
  return false;
};var _path = require('path');var _path2 = _interopRequireDefault(_path);var _anotherNameParser = require('another-name-parser');var _anotherNameParser2 = _interopRequireDefault(_anotherNameParser);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };} /*
                                                                                                                                                                                                                                                                                                    When importing files from a dat, there is likely to be extra data or things
                                                                                                                                                                                                                                                                                                    that just aren't in the right format. We'll define acceptable formats here
                                                                                                                                                                                                                                                                                                    (and for now that is just a Calibre library format)
                                                                                                                                                                                                                                                                                                     */ // Files to ignore, even if they are in the right place
const ignore = ['.DS_Store', '.dat', '.git'];const parsers = { // Calibre parser is the default one
  calibre: pathArr => {if (pathArr.length === 3 && !ignore.includes(pathArr[2])) {const name = (0, _anotherNameParser2.default)(pathArr[0]);return { author: pathArr[0], authorSort: `${name.last}, ${name.first}`, title: pathArr[1], file: pathArr[2] };}return false;} }; // Does the given candidate pass the formatting tests? (should it be added?)
// If so, return { author, author_sort, title, file }
//# sourceMappingURL=importers.js.map