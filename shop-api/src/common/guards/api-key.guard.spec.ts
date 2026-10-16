import { UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common/interfaces';
import { JwtService } from '@nestjs/jwt';
import { ApiKeyAuthGuard } from './api-key.guard';

function mockContext(headers: Record<string, string | undefined>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as ExecutionContext;
}

describe('ApiKeyAuthGuard', () => {
  const savedApiKey = process.env.SHOP_API_KEY;
  const savedJwtSecret = process.env.JWT_SECRET;

  afterEach(() => {
    if (savedApiKey === undefined) delete process.env.SHOP_API_KEY;
    else process.env.SHOP_API_KEY = savedApiKey;
    if (savedJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = savedJwtSecret;
  });

  it('passes a valid API key', async () => {
    process.env.SHOP_API_KEY = 'shop-secret';
    const guard = new ApiKeyAuthGuard(new JwtService({ secret: 'test' }));
    await expect(
      guard.canActivate(mockContext({ 'x-api-key': 'shop-secret' })),
    ).resolves.toBe(true);
  });

  it('rejects a wrong API key with 401', async () => {
    process.env.SHOP_API_KEY = 'shop-secret';
    const guard = new ApiKeyAuthGuard(new JwtService({ secret: 'test' }));
    await expect(
      guard.canActivate(mockContext({ 'x-api-key': 'nope' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a missing API key with 401 when no JWT is sent', async () => {
    process.env.SHOP_API_KEY = 'shop-secret';
    const guard = new ApiKeyAuthGuard(new JwtService({ secret: 'test' }));
    await expect(guard.canActivate(mockContext({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('accepts a valid Bearer JWT when JWT_SECRET is configured', async () => {
    process.env.JWT_SECRET = 'jwt-secret';
    const jwt = new JwtService({ secret: 'jwt-secret' });
    const guard = new ApiKeyAuthGuard(jwt);
    const token = await jwt.signAsync({ sub: 'user-1' });
    await expect(
      guard.canActivate(mockContext({ authorization: `Bearer ${token}` })),
    ).resolves.toBe(true);
  });

  it('ignores Bearer JWT when JWT_SECRET is unset, even for a signed token', async () => {
    delete process.env.JWT_SECRET;
    const jwt = new JwtService({ secret: 'jwt-secret' });
    const guard = new ApiKeyAuthGuard(jwt);
    const token = await jwt.signAsync({ sub: 'user-1' });
    await expect(
      guard.canActivate(mockContext({ authorization: `Bearer ${token}` })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a tampered Bearer JWT with 401', async () => {
    process.env.JWT_SECRET = 'jwt-secret';
    const guard = new ApiKeyAuthGuard(new JwtService({ secret: 'jwt-secret' }));
    await expect(
      guard.canActivate(mockContext({ authorization: 'Bearer tampered.token.here' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
