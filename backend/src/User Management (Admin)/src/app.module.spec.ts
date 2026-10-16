import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';

/**
 * Boot-level spec: compiles the full admin AppModule graph (imports,
 * controllers, providers) without a live database. The TypeORM DataSource is
 * stubbed so `TypeOrmModule.forRoot` never opens a real Postgres connection —
 * a missing provider or a circular import fails here in CI, not at boot.
 */
describe('AppModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DataSource)
      .useValue({
        entityMetadatas: [],
        options: { type: 'postgres' },
        getRepository: jest.fn(() => ({})),
        destroy: jest.fn(),
      })
      .compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('compiles the module graph without a live database', () => {
    expect(module.get(AppModule, { strict: false })).toBeDefined();
  });
});
