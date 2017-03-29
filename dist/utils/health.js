'use strict';Object.defineProperty(exports, "__esModule", { value: true });exports.default =


monitor;var _hyperhealth = require('hyperhealth');var _hyperhealth2 = _interopRequireDefault(_hyperhealth);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };} // Gets Health
function monitor(archive) {const health = (0, _hyperhealth2.default)(archive);

  // Will fire every 1 second
  setInterval(() => {
    const data = health.get();
    console.log(data.peers.length, 'total peers');
    console.log(data.bytes, 'total bytes');
    console.log(data.blocks, 'total blocks');
    console.log(`Peer 1 Downloaded ${data.peers[0].have / data.peers[0].blocks * 100}%`);
  }, 1000);
};