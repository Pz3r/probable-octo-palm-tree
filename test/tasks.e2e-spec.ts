import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

describe('Tasks API (e2e)', () => {
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

  it('runs the CRUD lifecycle', async () => {
    const server = app.getHttpServer();

    const created = await request(server).post('/tasks').send({ title: 'Try agents' }).expect(201);
    const id: string = created.body.id;

    await request(server)
      .get('/tasks')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveLength(1);
      });

    await request(server)
      .patch(`/tasks/${id}`)
      .send({ done: true })
      .expect(200)
      .expect((res) => expect(res.body.done).toBe(true));

    await request(server).delete(`/tasks/${id}`).expect(204);
    await request(server).get(`/tasks/${id}`).expect(404);
  });

  it('rejects invalid payloads', async () => {
    const server = app.getHttpServer();
    await request(server).post('/tasks').send({}).expect(400);
    await request(server).post('/tasks').send({ title: 'ok', extra: true }).expect(400);
    await request(server).get('/tasks/not-a-uuid').expect(400);
  });
});
