'use strict';Object.defineProperty(exports, "__esModule", { value: true });class PromiseQueue {
  constructor(cb) {this.





    next = () => {
      if (this.length > 0) {
        const nextFn = this.queue.shift();
        return this.wrap(nextFn.fn, nextFn.attempts);
      }
      this.promise = null;
      if (typeof this.callback === 'function') this.callback();
      return true;
    };this.

    errored = err => {
      console.error(err);
    };this.promise = null;this.queue = [];this.callback = cb;}

  wrap(fn, attempts) {
    let retryCount = 0;
    const retry = err => {
      retryCount += 1;
      return retryCount < attempts ?
      Promise.resolve(fn()).catch(retry) :
      this.errored(err);
    };
    return Promise.resolve(fn()).
    catch(retry).
    then(this.next);
  }

  add(fn, attempts) {
    const a = attempts && attempts > 0 ? attempts : 1;
    if (typeof fn !== 'function') throw new Error('PromiseQueue.add() expects a function as an argument.');
    if (this.promise === null) {
      this.promise = this.wrap(fn, a);
    } else {
      this.queue.push({ fn, attempts: a });
    }
  }

  get length() {
    return this.queue.length;
  }}exports.default =


PromiseQueue;
//# sourceMappingURL=PromiseQueue.js.map