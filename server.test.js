/**
 * @jest-environment node
 */

const { rateLimitMiddleware, socketConnectCount } = require('./server');

describe('Socket.io Rate Limiting Middleware', () => {
  beforeEach(() => {
    // Clear the map before each test to ensure tests are isolated
    socketConnectCount.clear();
  });

  afterEach(() => {
    // Also clear the map after each test just in case
    socketConnectCount.clear();
  });

  it('should allow connections if the IP has less than or equal to 10 connections', () => {
    const mockSocket = {
      handshake: {
        address: '192.168.1.1',
      },
    };
    const mockNext = jest.fn();

    // Connect 10 times
    for (let i = 0; i < 10; i++) {
      rateLimitMiddleware(mockSocket, mockNext);
    }

    // Verify next was called 10 times and never with an error
    expect(mockNext).toHaveBeenCalledTimes(10);
    for (let i = 1; i <= 10; i++) {
      expect(mockNext).toHaveBeenNthCalledWith(i); // Called with no arguments (success)
    }
  });

  it('should block the 11th connection from the same IP with an error', () => {
    const mockSocket = {
      handshake: {
        address: '192.168.1.1',
      },
    };
    const mockNext = jest.fn();

    // Connect 10 times
    for (let i = 0; i < 10; i++) {
      rateLimitMiddleware(mockSocket, mockNext);
    }

    // Verify we reached exactly 10 calls to next()
    expect(mockNext).toHaveBeenCalledTimes(10);

    // Connect an 11th time
    rateLimitMiddleware(mockSocket, mockNext);

    // Verify next was called 11 times overall
    expect(mockNext).toHaveBeenCalledTimes(11);

    // The 11th call should have the Too many connections error
    expect(mockNext).toHaveBeenLastCalledWith(new Error('Too many connections from this IP'));
  });

  it('should track connections per IP address separately', () => {
    const mockSocket1 = {
      handshake: {
        address: '192.168.1.1',
      },
    };
    const mockSocket2 = {
      handshake: {
        address: '10.0.0.1',
      },
    };
    const mockNext1 = jest.fn();
    const mockNext2 = jest.fn();

    // Connect 10 times from IP 1
    for (let i = 0; i < 10; i++) {
      rateLimitMiddleware(mockSocket1, mockNext1);
    }

    // Connect 10 times from IP 2
    for (let i = 0; i < 10; i++) {
      rateLimitMiddleware(mockSocket2, mockNext2);
    }

    // Connect 11th time from IP 1 should fail
    rateLimitMiddleware(mockSocket1, mockNext1);
    expect(mockNext1).toHaveBeenLastCalledWith(new Error('Too many connections from this IP'));

    // Connect 11th time from IP 2 should also fail
    rateLimitMiddleware(mockSocket2, mockNext2);
    expect(mockNext2).toHaveBeenLastCalledWith(new Error('Too many connections from this IP'));
  });
});
