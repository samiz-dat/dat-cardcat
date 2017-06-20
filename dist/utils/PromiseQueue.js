'use strict';Object.defineProperty(exports, "__esModule", { value: true });class PromiseQueue {
  constructor(cb) {this.





    next = () => {
      if (this.length > 0) {
        const nextFn = this.queue.shift();
        return this.wrap(nextFn.fn, nextFn.cb, nextFn.attempts);
      }
      this.promise = null;
      if (typeof this.callback === 'function') this.callback();
      return true;
    };this.

    errored = err => {
      console.error(err);
      return err;
    };this.promise = null;this.queue = [];this.callback = cb;}

  resolve(fn) {
    try {
      return Promise.resolve(fn());
    } catch (e) {
      return Promise.reject(e);
    }
  }

  wrap(fn, cb, attempts) {
    let retryCount = 0;
    const retry = err => {
      retryCount += 1;
      return retryCount < attempts ?
      this.resolve(fn).catch(retry) :
      this.errored(err);
    };
    return this.resolve(fn).
    catch(retry).
    then((...args) => {
      // need a nice way of differentiating between failed calls and successfull
      if (cb) cb(...args);
    }).
    then(this.next);
  }

  add(fn, cb, opts) {
    if (typeof fn !== 'function') throw new Error('PromiseQueue.add() expects a function as an argument.');
    if (!opts && typeof cb === 'object') {
      return this.add(fn, null, cb);
    }
    const attempts = opts && opts.attempts && opts.attempts > 0 ? opts.attempts : 1;
    if (this.promise === null) {
      this.promise = this.wrap(fn, cb, attempts);
    } else {
      // shift order based on priority
      const next = {
        fn,
        attempts,
        priority: opts && opts.priority ? opts.priority : 0,
        cb: typeof cb === 'function' ? cb : undefined };

      if (!opts || !opts.priority) {
        this.queue.push(next);
      } else {
        let found = false;
        for (let i = this.length - 1; i >= 0; i--) {
          if (this.queue[i].priority && this.queue[i].priority >= opts.priority) {
            this.queue.splice(i + 1, 0, next);
            found = true;
            break;
          }
        }
        if (!found) {
          this.queue.unshift(next);
        }
      }
    }
    return this;
  }

  get length() {
    return this.queue.length;
  }}exports.default =


PromiseQueue;
//# sourceMappingURL=PromiseQueue.js.map