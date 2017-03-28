'use strict';Object.defineProperty(exports, "__esModule", { value: true });exports.











































































opf2js = opf2js;exports.







js2opf = js2opf;var _fs = require('fs');var _fs2 = _interopRequireDefault(_fs);var _bluebird = require('bluebird');var _bluebird2 = _interopRequireDefault(_bluebird);var _xml2js = require('xml2js');var _xml2js2 = _interopRequireDefault(_xml2js);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}_bluebird2.default.promisifyAll(_fs2.default); /*
                                                                                                                                                                                                                                                                                                                                                                                                  * OPF metadata handling
                                                                                                                                                                                                                                                                                                                                                                                                  * Ability to do basic reading and writing of Calibre's opf (xml) metadata format
                                                                                                                                                                                                                                                                                                                                                                                                  */_bluebird2.default.promisifyAll(_xml2js2.default); // Extracted Opf metadata gets packaged into an OPF
class OPF {constructor(parsedXmlData) {this.data = parsedXmlData;this.obj = parsedXmlData.package.metadata[0];}get title() {return this.getField('dc:title');}set title(s) {this.obj['dc:title'] = s;}get authors() {return this.getList('dc:creator');}get description() {return this.getField('dc:description');} // This is just for testing
  get undefined() {return this.getField('dc:undefined_field');}getList(name, id = '_') {if (name in this.obj) {if (Array.isArray(this.obj[name])) {return this.obj[name].map(c => c[id]);}}return undefined;}getField(name, idx = 0) {if (name in this.obj) {if (Array.isArray(this.obj[name]) && this.obj[name].length > idx) {return this.obj[name][idx];}}return undefined;}get identifiers() {const ids = {};const obj = this.obj;ids[Symbol.iterator] = function* () {if (Array.isArray(obj['dc:identifier'])) {for (const i of obj['dc:identifier']) {if ('$' in i && '_' in i && 'opf:scheme' in i.$) {const id = {};id[i.$['opf:scheme']] = i._;yield id;}}}};return ids;}} // Parses an opf file
function opf2js(fileLoc, encoding = 'utf-8') {return _fs2.default.readFileAsync(fileLoc, encoding).then(data => _xml2js2.default.parseStringAsync(data)).then(data => new OPF(data)).catch(err => {console.log(err);});} // Writes an opf file from an OPF object
function js2opf(fileLoc, obj) {console.log(`Writing OPFs is not implemented yet: ${obj}`);}