"use strict";Object.defineProperty(exports, "__esModule", { value: true });const flatten = exports.flatten = list =>
list.reduce((a, b) => a.concat(Array.isArray(b) ? flatten(b) : b), []);

const echo = exports.echo = list => list;
//# sourceMappingURL=data.js.map