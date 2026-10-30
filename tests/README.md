Test DB and Prisma mocking helpers

- To run tests against a disposable Postgres container (recommended):

  1. Start the DB:

     ```bash
     npm run test:db:up
     ```

  2. Wait until Postgres is healthy (compose healthcheck). Then run tests:

     ```bash
     npm test -- --runInBand
     ```

  3. Tear down the DB when done:

     ```bash
     npm run test:db:down
     ```

- To run unit tests without a DB for tests that don't need Prisma, add this at the top of the test file before requiring app code:

  ```ts
  import { mockPrisma } from './helpers/mockPrisma';
  mockPrisma();
  ```

  This will replace `@prisma/client`'s `PrismaClient` with a lightweight mock. Only use this for tests that do not assert against real DB data.
