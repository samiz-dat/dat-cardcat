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
    }).catch(done);
    const immediatePromise = linear.immediate(2, 3);
    expect(immediatePromise).to.be.a.instanceof(Promise);
    immediatePromise.then((result) => {
      expect(result).to.equal(5);
      done();
    }).catch(done);
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
    }).catch(done);
    linear.immediate().then(() => {
      count++;
      expect(count).to.equal(2);
      done();
    }).catch(done);
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
    }).catch(done);
    // test priority
    linear.delayed(100, 'last', { priority: 1 }).then((res) => {
      count++;
      expect(count).to.equal(5);
      expect(res).to.equal('last');
    }).catch(done);

    linear.delayed(10, 'third', { priority: 2 }).then((res) => {
      count++;
      expect(count).to.equal(3);
      expect(res).to.equal('third');
    }).catch(done);

    linear.delayed(10, 'fouth', { priority: 2 }).then((res) => {
      count++;
      expect(count).to.equal(4);
      expect(res).to.equal('fouth');
      done();
    }).catch(done);

    linear.delayed(10, 'second', { priority: 4 }).then((res) => {
      count++;
      expect(count).to.equal(2);
      expect(res).to.equal('second');
    }).catch(done);
  });

  it('accepts second argument as options object with ignore property being an array of method names not to sequentialise', (done) => {
    const object = {
      delayed: x => bluebird.delay(100).then(() => x),
      immediate: () => 'immediate',
      ignore: () => 'ignored',
    };
    const linear = sequentialise(object, { ignore: ['immediate', 'ignore'] });
    const delayed = linear.delayed('ok');
    expect(linear.ignore()).to.not.be.instanceof(Promise);
    expect(linear.immediate()).to.not.be.instanceof(Promise);
    expect(delayed).to.be.instanceof(Promise);
    delayed.then((result) => {
      expect(result).to.equal('ok');
      done();
    }).catch(done);
    expect(linear.ignore()).to.equal('ignored');
    expect(linear.immediate()).to.equal('immediate');
  });

  it('accepts second argument as options object with promise property being constructor for promise type', (done) => {
    const object = {
      identity: x => x,
    };
    const linear = sequentialise(object, { promise: bluebird });
    const identity = linear.identity('ok');
    expect(identity).to.be.instanceof(bluebird);
    identity.then((v) => {
      expect(v).to.equal('ok');
      done();
    })
    .catch(done);
  });
});
