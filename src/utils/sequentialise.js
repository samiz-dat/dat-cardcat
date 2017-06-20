import PromiseQueue from './PromiseQueue';

// export class Sequentialise {
//   constructor(object) {
//     this.queue = new PromiseQueue();
//     for (const key of object) {
//       const fn = object[key];
//       if (typeof fn === 'function' && Object.prototype.hasOwnProperty.call(object, key)) {
//         this[key] = (...args) => {
//           const opts = (args.length > fn.length) ? args.pop() : undefined;
//           return this.execute(fn.bind(object, ...args), opts);
//         };
//       }
//     }
//   }

//   execute(queryFn, opts) {
//     return new Promise(resolve => this.queue.add(queryFn, resolve, opts));
//   }
// }

export default function sequentialise(obj, opts) {
  const P = (opts && opts.promise) ? opts.promise : Promise;
  const ignore = (opts && Array.isArray(opts.ignore)) ? opts.ignore : [];

  const queue = new PromiseQueue();

  function execute(queryFn, queueOptions) {
    return new P(resolve => queue.add(queryFn, resolve, queueOptions));
  }
  const handler = {
    get(target, propKey, receiver) {
      const origMethod = target[propKey];
      if (typeof origMethod !== 'function' || (ignore.includes(propKey))) return origMethod;
      return (...args) => {
        const queueOptions = (args.length > origMethod.length) ? args.pop() : undefined;
        return execute(origMethod.bind(receiver, ...args), queueOptions);
      };
    },
  };
  return new Proxy(obj, handler);
}
