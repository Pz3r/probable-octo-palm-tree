import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8')) as {
  version: string;
};

describe('Health API (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('AC1: GET /health returns 200 with status "ok"', async () => {
    const server = app.getHttpServer();
    await request(server)
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
      });
  });

  it('AC2: uptimeSeconds is a non-negative integer that increases over time', async () => {
    const server = app.getHttpServer();

    const first = await request(server).get('/health').expect(200);
    expect(Number.isInteger(first.body.uptimeSeconds)).toBe(true);
    expect(first.body.uptimeSeconds).toBeGreaterThanOrEqual(0);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    const second = await request(server).get('/health').expect(200);
    expect(second.body.uptimeSeconds).toBeGreaterThan(first.body.uptimeSeconds);
  });

  it('AC3: version equals the version field in package.json', async () => {
    const server = app.getHttpServer();
    await request(server)
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.version).toBe(packageJson.version);
      });
  });

  it('AC4: response contains exactly status, uptimeSeconds and version', async () => {
    const server = app.getHttpServer();
    await request(server)
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(Object.keys(res.body).sort()).toEqual(['status', 'uptimeSeconds', 'version'].sort());
      });
  });
});
