import chai from 'chai';
import bluebird from 'bluebird';
import sequentialise from '../src/utils/sequentialise';

const expect = chai.expect;

describe('sequentialise', () => {
  it('wraps an object transparently, returning object with get as if it was the object', () => {
    const object = {
      foo: x => bluebird.delay(100).then(() => x),
      bar: () => 'bar',
      notafunc: 'hmmm',
    };
    const linear = sequentialise(object);

    expect(linear).to.be.instanceOf(Object);
    expect(linear.foo).to.be.a('function');
    expect(linear.bar).to.be.a('function');
    expect(linear.notafunc).to.equal('hmmm');
  });

  it('methods return promises that eventually return the same results as if called on proxied object', (done) => {
    const object = {
      delayed: x => bluebird.delay(10).then(() => x),
      immediate: (a, b) => a + b,
    };
    const linear = sequentialise(object);
    const args = { ok: 'yes', no: null };
    const delayedPromise = linear.delayed(args);
    expect(delayedPromise).to.be.a.instanceof(Promise);
    delayedPromise.then((result) => {
      expect(result).to.equal(args);
    });
    const immediatePromise = linear.immediate(2, 3);
    expect(immediatePromise).to.be.a.instanceof(Promise);
    immediatePromise.then((result) => {
      expect(result).to.equal(5);
      done();
    });
  });

  it('functions are executed sequentially', (done) => {
    const object = {
      delayed: x => bluebird.delay(100).then(() => x),
      immediate: () => 'immediate',
    };
    const linear = sequentialise(object);
    let count = 0;
    linear.delayed('ok').then((result) => {
      count++;
      expect(result).to.equal('ok');
      expect(count).to.equal(1);
    });
    linear.immediate().then(() => {
      count++;
      expect(count).to.equal(2);
      done();
    });
  });

  it('when passed arguents more than the original method expects, the last is passed as options to the promise queue', (done) => {
    let retryCount = 0;
    let count = 0;
    const retry = 3;
    const object = {
      delayed: (d, x) => bluebird.delay(d).then(() => x),
      noargs: () => {
        retryCount += 1;
        console.log('count error', retryCount);
        if (retryCount < retry) throw Error('opps');
        return 'no args';
      },
    };
    const linear = sequentialise(object);
    // test retry options
    linear.noargs({ attempts: 4 }).then((res) => {
      count++;
      expect(count).to.equal(1);
      expect(res).to.equal('no args');
    });
    // test priority
    linear.delayed(100, 'first', { priority: 1 }).then((res) => {
      count++;
      expect(count).to.equal(1);
      expect(res).to.equal('first');
    });

    linear.delayed(10, 'third', { priority: 2 }).then((res) => {
      count++;
      expect(count).to.equal(3);
      expect(res).to.equal('third');
    });

    linear.delayed(10, 'last', { priority: 2 }).then((res) => {
      count++;
      expect(count).to.equal(4);
      expect(res).to.equal('last');
      done();
    });

    linear.delayed(10, 'second', { priority: 4 }).then((res) => {
      count++;
      expect(count).to.equal(2);
      expect(res).to.equal('second');
    });
  });
});
