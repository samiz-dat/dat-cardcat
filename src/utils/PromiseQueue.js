class PromiseQueue {
  constructor(cb) {
    this.promise = null;
    this.queue = [];
    this.callback = cb;
  }

  next = () => {
    if (this.length > 0) {
      const fn = this.queue.shift();
      return Promise.resolve(fn())
        .catch(this.errored)
        .then(this.next);
    }
    this.promise = null;
    this.callback();
    return true;
  }

  errored = (err) => {
    console.error(err);
  }

  add(fn) {
    if (typeof fn !== 'function') throw new Error('PromiseQueue.add() expects a function as an argument.');
    if (this.promise === null) {
      this.promise = Promise.resolve(fn()).catch(this.errored).then(this.next);
    } else {
      this.queue.push(fn);
    }
  }

  get length() {
    return this.queue.length;
  }
}

export default PromiseQueue;
