const { performance } = require('perf_hooks');

const CACHE_NAME = 'nexcall-v1';
// Create a large array of keys
const keys = Array.from({ length: 10000 }, (_, i) => `cache-v${i}`);
keys.push(CACHE_NAME); // add the one we want to keep

// Mock caches.delete
const caches = {
  delete: (k) => Promise.resolve(true)
};

function original() {
  return keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k));
}

function optimizedForOf() {
  const promises = [];
  for (const k of keys) {
    if (k !== CACHE_NAME) {
      promises.push(caches.delete(k));
    }
  }
  return promises;
}

function optimizedReduce() {
  return keys.reduce((acc, k) => {
    if (k !== CACHE_NAME) {
      acc.push(caches.delete(k));
    }
    return acc;
  }, []);
}

function runBenchmark(name, fn) {
  const iterations = 1000;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();
  const duration = end - start;
  console.log(`${name}: ${duration.toFixed(2)}ms for ${iterations} iterations`);
  return duration;
}

// Warmup
for(let i=0; i<10; i++) { original(); optimizedForOf(); optimizedReduce(); }

const origDuration = runBenchmark('Original (filter + map)', original);
const optForOfDuration = runBenchmark('Optimized (for...of loop)', optimizedForOf);
const optReduceDuration = runBenchmark('Optimized (reduce)', optimizedReduce);

console.log(`\nImprovement (for...of loop): ${((origDuration - optForOfDuration) / origDuration * 100).toFixed(2)}% faster`);
console.log(`Improvement (reduce): ${((origDuration - optReduceDuration) / origDuration * 100).toFixed(2)}% faster`);
