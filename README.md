# Education Care Africa Backend

API for school operations, platform management, and real-time notifications.

## Features

- School and platform authentication
- Student, parent, staff, attendance, fees, exams, gate, and visitor modules
- Real-time notifications over Socket.IO
- Swagger/OpenAPI docs at `/api/docs`

## Tech Stack

- Node.js, Express, TypeScript
- Prisma + PostgreSQL
- Socket.IO, BullMQ
- Zod, Swagger

## Getting Started

### Requirements

- Node.js 18+
- PostgreSQL
- Redis (optional, for background jobs)

### Install

```bash
npm install
```

### Environment

Create a `.env` file in the Backend root:

```dotenv
DATABASE_URL=postgresql://user:pass@localhost:5432/ecareafrica?schema=public
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
PLATFORM_JWT_SECRET=your-platform-jwt-secret
PLATFORM_JWT_REFRESH_SECRET=your-platform-refresh-secret
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
S3_ENDPOINT=https://s3.example.com
S3_REGION=us-east-1
S3_BUCKET=ecareafrica
S3_ACCESS_KEY_ID=access-key
S3_SECRET_ACCESS_KEY=secret-key
S3_PUBLIC_URL=https://cdn.example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=username
SMTP_PASS=password
SMTP_FROM=noreply@ecareafrica.test
REDIS_URL=redis://localhost:6379
```

### Database

```bash
npx prisma migrate dev &&
npm run prisma:generate
```

```bash
npm run prisma:deploy
```

### Run

```bash
npm run dev
```

### Seed Data

```bash
npm run seed
```

## Tests

```bash
npm test
npm run test:watch
```

Tests load default environment values from `tests/setupEnv.ts`. Override any value by
exporting the variable before running the test command.

## API Docs

Visit `http://localhost:PORT/api/docs` after starting the server.

## Project Structure

- `src/app.ts`: Express app setup
- `src/server.ts`: HTTP server, Socket.IO, and workers
- `src/routes`: Route definitions
- `src/controllers`: Request handlers
- `src/services`: Business logic
- `src/seeders`: Seed data
- `tests`: Jest + supertest suites

## Notes

- When `REDIS_URL` is not set, background jobs run inline.
- Socket.IO shares the same server and respects `CORS_ORIGIN`.
