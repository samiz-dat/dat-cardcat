class PromiseQueue {
  constructor(cb) {
    this.promise = null;
    this.queue = [];
    this.callback = cb;
  }

  next = () => {
    if (this.length > 0) {
      return this.wrap(this.queue.shift());
    }
    this.promise = null;
    if (typeof this.callback === 'function') this.callback();
    return true;
  }

  errored = (err) => {
    console.error(err);
  }

  wrap(fn, attempts = 1) {
    let retryCount = 0;
    const retry = (err) => {
      retryCount += 1;
      return (retryCount < attempts)
        ? Promise.resolve(fn()).catch(retry)
        : this.errored(err);
    };
    return Promise.resolve(fn())
      .catch(retry)
      .then(this.next);
  }

  add(fn, attempts) {
    if (typeof fn !== 'function') throw new Error('PromiseQueue.add() expects a function as an argument.');
    if (this.promise === null) {
      this.promise = this.wrap(fn, attempts);
    } else {
      this.queue.push(fn);
    }
  }

  get length() {
    return this.queue.length;
  }
}

export default PromiseQueue;
