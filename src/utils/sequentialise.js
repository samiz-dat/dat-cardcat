import PromiseQueue from './PromiseQueue';

export default function sequentialise(obj) {
  const queue = new PromiseQueue();
  function execute(queryFn, opts) {
    return new Promise(resolve => queue.add(queryFn, resolve, opts));
  }
  const handler = {
    get(target, propKey, receiver) {
      const origMethod = target[propKey];
      if (typeof origMethod !== 'function') return origMethod;
      return (...args) => {
        const opts = (args.length > origMethod.length) ? args.pop() : undefined;
        return execute(origMethod.bind(receiver, ...args), opts);
      };
    },
  };
  return new Proxy(obj, handler);
}
