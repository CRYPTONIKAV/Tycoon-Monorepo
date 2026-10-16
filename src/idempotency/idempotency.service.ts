import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan } from "typeorm";
import { createHash } from "crypto";
import { IdempotencyRecord } from "./idempotency-record.entity";

/** How long a stored outcome is valid (24 h). */
const TTL_MS = 24 * 60 * 60 * 1000;

export type StoredOutcome = {
  payloadHash: string;
  response: Record<string, unknown>;
  statusCode: number;
};

@Injectable()
export class IdempotencyService implements OnModuleInit {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @InjectRepository(IdempotencyRecord)
    private readonly repo: Repository<IdempotencyRecord>,
  ) {}

  /**
   * Purge rows expired before boot, so the table does not grow unbounded
   * waiting for a client to replay each key. Guarded: a purge failure must
   * never crash boot; it is logged and retried on the next replay.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.purgeExpired();
    } catch (error) {
      this.logger.warn(
        `Startup purge of expired idempotency records failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  buildId(method: string, path: string, key: string): string {
    return `${method.toUpperCase()}:${path}:${key}`;
  }

  hashPayload(body: unknown): string {
    return createHash("sha256")
      .update(JSON.stringify(body ?? {}))
      .digest("hex");
  }

  async find(id: string): Promise<IdempotencyRecord | null> {
    const record = await this.repo.findOne({ where: { id } });
    if (!record) return null;
    if (record.expiresAt < new Date()) {
      await this.repo.delete(id);
      return null;
    }
    return record;
  }

  async store(
    id: string,
    payloadHash: string,
    statusCode: number,
    response: Record<string, unknown>,
  ): Promise<void> {
    const record = this.repo.create({
      id,
      payloadHash,
      statusCode,
      response,
      expiresAt: new Date(Date.now() + TTL_MS),
    });
    await this.repo.save(record);
  }

  /** Purge expired records (call from a scheduled job or on startup). */
  async purgeExpired(): Promise<void> {
    await this.repo.delete({ expiresAt: LessThan(new Date()) });
  }
}
