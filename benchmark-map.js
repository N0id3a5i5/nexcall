const { performance } = require('perf_hooks');

const NUM_IPS = 1000000;

function originalBehavior() {
  const socketConnectCount = new Map();
  const start = performance.now();

  // Simulate 1M unique IPs connecting
  for (let i = 0; i < NUM_IPS; i++) {
    const ip = `192.168.1.${i}`;
    socketConnectCount.set(ip, 1);
  }

  // Simulate all 1M unique IPs disconnecting
  for (let i = 0; i < NUM_IPS; i++) {
    const ip = `192.168.1.${i}`;
    const count = socketConnectCount.get(ip) || 1;
    socketConnectCount.set(ip, Math.max(0, count - 1));
  }

  const end = performance.now();

  return {
    time: end - start,
    mapSize: socketConnectCount.size,
    memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024
  };
}

function optimizedBehavior() {
  const socketConnectCount = new Map();
  const start = performance.now();

  // Simulate 1M unique IPs connecting
  for (let i = 0; i < NUM_IPS; i++) {
    const ip = `192.168.1.${i}`;
    socketConnectCount.set(ip, 1);
  }

  // Simulate all 1M unique IPs disconnecting
  for (let i = 0; i < NUM_IPS; i++) {
    const ip = `192.168.1.${i}`;
    const count = socketConnectCount.get(ip) || 1;
    if (count <= 1) {
      socketConnectCount.delete(ip);
    } else {
      socketConnectCount.set(ip, count - 1);
    }
  }

  const end = performance.now();

  return {
    time: end - start,
    mapSize: socketConnectCount.size,
    memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024
  };
}

// Garbage collection is tricky, so let's run them in isolation
const runOriginal = process.argv[2] === 'original';

if (runOriginal) {
  const result = originalBehavior();
  console.log(`Original Behavior:`);
  console.log(`  Time: ${result.time.toFixed(2)}ms`);
  console.log(`  Map Size: ${result.mapSize}`);
  console.log(`  Memory Used: ${result.memoryUsageMB.toFixed(2)} MB`);
} else {
  const result = optimizedBehavior();
  console.log(`Optimized Behavior:`);
  console.log(`  Time: ${result.time.toFixed(2)}ms`);
  console.log(`  Map Size: ${result.mapSize}`);
  console.log(`  Memory Used: ${result.memoryUsageMB.toFixed(2)} MB`);
}
