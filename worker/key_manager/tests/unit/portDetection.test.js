const detectAvailablePort = require('../../api/utils/portDetection');
const net = require('net');

jest.mock('net');

describe('Port Detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('should detect available port', async () => {
    const mockServer = {
      listen: jest.fn((port, callback) => {
        callback();
      }),
      address: jest.fn(() => ({ port: 3002 })),
      close: jest.fn((callback) => {
        callback();
      }),
      on: jest.fn()
    };
    
    net.createServer.mockReturnValue(mockServer);
    
    const port = await detectAvailablePort(3002);
    
    expect(port).toBe(3002);
    expect(mockServer.listen).toHaveBeenCalledWith(3002, expect.any(Function));
    expect(mockServer.close).toHaveBeenCalled();
  });
  
  // TODO: rewrite this test cleanly. The current implementation calls
  // .mockImplementationOnce on the actual function under test (not a Jest mock),
  // which is structurally broken. A correct version should mock `net.createServer`
  // to emit EADDRINUSE on the first listen() and succeed on the second, then
  // assert the recursive port-bump behaviour.
  test.skip('should try next port if port is in use', async () => {
    let callCount = 0;
    const mockServer = {
      listen: jest.fn((port, callback) => {
        callCount++;
        if (callCount === 1) {
          // First call fails with EADDRINUSE
          const error = new Error('Port in use');
          error.code = 'EADDRINUSE';
          mockServer.listen.mockImplementationOnce(() => {
            mockServer.on.mock.calls.find(call => call[0] === 'error')[1](error);
          });
        } else {
          // Second call succeeds
          callback();
        }
      }),
      address: jest.fn(() => ({ port: 3003 })),
      close: jest.fn((callback) => {
        callback();
      }),
      on: jest.fn((event, handler) => {
        if (event === 'error' && callCount === 1) {
          // Store handler for first call
          setTimeout(() => {
            const error = new Error('Port in use');
            error.code = 'EADDRINUSE';
            handler(error);
          }, 0);
        }
      })
    };
    
    net.createServer.mockReturnValue(mockServer);
    
    // Mock recursive call
    const originalDetect = detectAvailablePort;
    detectAvailablePort.mockImplementationOnce(async (startPort) => {
      if (startPort === 3002) {
        // Simulate port in use, try next
        return await originalDetect(3003);
      }
      return 3003;
    });
    
    const port = await detectAvailablePort(3002);
    
    expect(port).toBeGreaterThanOrEqual(3002);
  });
});
