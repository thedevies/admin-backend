import { AppLogger } from './logger';

describe('AppLogger', () => {
  let infoSpy: jest.SpyInstance;

  beforeEach(() => {
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    infoSpy.mockRestore();
  });

  it('logs structured metadata including reqId, controller, functionName, reqBody, data and msg', () => {
    const logger = new AppLogger();

    logger.info('User created', {
      reqId: 'req-123',
      controller: 'AuthController',
      functionName: 'signup',
      reqBody: { email: 'user@example.com' },
      data: { success: true },
      msg: 'User created successfully',
    });

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('"level":"info"'),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('"reqId":"req-123"'),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('"controller":"AuthController"'),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('"functionName":"signup"'),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('"reqBody":{"email":"u**r@example.com"}'),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('"data":{"success":true}'),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('"msg":"User created successfully"'),
    );
  });

  describe('debug log suppression', () => {
    let debugSpy: jest.SpyInstance;
    const originalEnv = process.env;

    beforeEach(() => {
      debugSpy = jest
        .spyOn(console, 'debug')
        .mockImplementation(() => undefined);
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      debugSpy.mockRestore();
      process.env = originalEnv;
    });

    it('should log debug messages when not in production', () => {
      process.env.NODE_ENV = 'development';
      const logger = new AppLogger();
      logger.debug('debug message');

      expect(debugSpy).toHaveBeenCalled();
    });

    it('should suppress debug messages when in production', () => {
      process.env.NODE_ENV = 'production';
      const logger = new AppLogger();
      logger.debug('debug message');

      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('should log debug messages in production when LOG_LEVEL is debug', () => {
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'debug';
      const logger = new AppLogger();
      logger.debug('debug message');

      expect(debugSpy).toHaveBeenCalled();
    });
  });
});
