import { LessThan } from "typeorm";
import { IdempotencyService } from "./idempotency.service";

const record = (overrides: Record<string, unknown> = {}) => ({
  id: "GET:/x:k",
  payloadHash: "abc",
  statusCode: 200,
  response: {},
  expiresAt: new Date(Date.now() + 3600_000),
  ...overrides,
});

const repository = () => ({
  findOne: jest.fn(),
  delete: jest.fn(),
  create: jest.fn((value: unknown) => value),
  save: jest.fn((value: unknown) => Promise.resolve(value)),
});

const serviceWith = (repo: ReturnType<typeof repository>) =>
  new IdempotencyService(repo as never);

describe("IdempotencyService", () => {
  it("builds ids from upper-cased method, path and key", () => {
    const service = serviceWith(repository());
    expect(service.buildId("get", "/x", "k")).toBe("GET:/x:k");
  });

  it("hashes deterministically (insertion order, as JSON.stringify)", () => {
    const service = serviceWith(repository());
    expect(service.hashPayload({ a: 1, b: 2 })).toBe(
      service.hashPayload({ a: 1, b: 2 }),
    );
    expect(service.hashPayload(undefined)).toBe(service.hashPayload({}));
  });

  it("deletes an expired record on read and answers null", async () => {
    const repo = repository();
    repo.findOne.mockResolvedValue(
      record({ expiresAt: new Date(Date.now() - 1000) }),
    );
    const service = serviceWith(repo);

    await expect(service.find("GET:/x:k")).resolves.toBeNull();
    expect(repo.delete).toHaveBeenCalledWith("GET:/x:k");
  });

  it("keeps a live record on read", async () => {
    const repo = repository();
    const live = record();
    repo.findOne.mockResolvedValue(live);
    const service = serviceWith(repo);

    await expect(service.find("GET:/x:k")).resolves.toBe(live);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it("purges expired rows", async () => {
    const repo = repository();
    const service = serviceWith(repo);

    await service.purgeExpired();

    expect(repo.delete).toHaveBeenCalledWith({
      expiresAt: LessThan(expect.any(Date)),
    });
  });

  it("purges on module init", async () => {
    const repo = repository();
    const service = serviceWith(repo);

    await expect(service.onModuleInit()).resolves.toBeUndefined();

    expect(repo.delete).toHaveBeenCalledWith({
      expiresAt: LessThan(expect.any(Date)),
    });
  });

  it("purges on module init without crashing boot when the purge fails", async () => {
    const repo = repository();
    repo.delete.mockRejectedValue(new Error("db is down"));
    const service = serviceWith(repo);

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(repo.delete).toHaveBeenCalled();
  });
});
