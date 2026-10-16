import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';

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
    expect(module.get(AppModule)).toBeInstanceOf(AppModule);
    expect(module.get(UsersController)).toBeInstanceOf(UsersController);
    expect(module.get(UsersService)).toBeInstanceOf(UsersService);
  });
});
