'use strict';Object.defineProperty(exports, "__esModule", { value: true });

class PromiseQueue {
  constructor(cb, PromiseFlavour) {
    this.Promise = PromiseFlavour || Promise;
    this.promise = null;
    this.queue = [];
    this.callback = cb;
  }

  promised(fn) {
    try {
      return this.Promise.resolve(fn());
    } catch (e) {
      return this.Promise.reject(e);
    }
  }

  next() {
    if (this.length > 0) {
      const nextFn = this.queue.shift();
      return this.wrap(nextFn.fn, nextFn.resolve, nextFn.reject, nextFn.attempts);
    }
    this.promise = null;
    if (typeof this.callback === 'function') this.callback();
    return true;
  }

  wrap(fn, resolve, reject, attempts) {
    let retryCount = 0;
    const retry = err => {
      if (retryCount >= attempts) {
        throw err || new Error('Unknown Error');
      }
      retryCount += 1;
      return this.promised(fn).catch(retry);
    };
    return retry().
    then(r => {resolve(r);}, e => {reject(e);}).
    then(() => this.next());
  }

  add(fn, opts) {
    if (typeof fn !== 'function') throw new Error('PromiseQueue.add() expects a function as an argument.');
    return new this.Promise((resolve, reject) => {
      const attempts = opts && opts.attempts && opts.attempts > 0 ? opts.attempts : 1;
      if (this.promise === null) {
        this.promise = this.wrap(fn, resolve, reject, attempts);
      } else {
        // shift order based on priority
        const next = {
          fn,
          attempts,
          priority: opts && opts.priority ? opts.priority : 0,
          resolve,
          reject };

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
    });
  }

  get length() {
    return this.queue.length;
  }}exports.default =


PromiseQueue;
//# sourceMappingURL=PromiseQueue.js.map