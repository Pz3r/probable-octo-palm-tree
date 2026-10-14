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

  it('AC1: creating a task without priority returns it with priority "medium"', async () => {
    const server = app.getHttpServer();
    const created = await request(server).post('/tasks').send({ title: 'no priority' }).expect(201);
    expect(created.body.priority).toBe('medium');
  });

  it.each(['low', 'medium', 'high'])(
    'AC2: creating a task with priority "%s" stores and returns that value',
    async (priority) => {
      const server = app.getHttpServer();
      const created = await request(server)
        .post('/tasks')
        .send({ title: 'with priority', priority })
        .expect(201);
      expect(created.body.priority).toBe(priority);
    },
  );

  it('AC3: rejects an unknown priority on create with 400', async () => {
    const server = app.getHttpServer();
    const enumErrorMatcher = expect.arrayContaining([
      expect.stringContaining('priority must be one of the following values'),
    ]);

    const invalidString = await request(server)
      .post('/tasks')
      .send({ title: 'bad', priority: 'urgent' })
      .expect(400);
    expect(invalidString.body.message).toEqual(enumErrorMatcher);

    const invalidNumber = await request(server)
      .post('/tasks')
      .send({ title: 'bad', priority: 1 })
      .expect(400);
    expect(invalidNumber.body.message).toEqual(enumErrorMatcher);
  });

  it('AC3: rejects an unknown priority on update with 400', async () => {
    const server = app.getHttpServer();
    const created = await request(server).post('/tasks').send({ title: 'to update' }).expect(201);
    const id: string = created.body.id;
    const enumErrorMatcher = expect.arrayContaining([
      expect.stringContaining('priority must be one of the following values'),
    ]);

    const invalidString = await request(server)
      .patch(`/tasks/${id}`)
      .send({ priority: 'urgent' })
      .expect(400);
    expect(invalidString.body.message).toEqual(enumErrorMatcher);

    const invalidNumber = await request(server)
      .patch(`/tasks/${id}`)
      .send({ priority: 1 })
      .expect(400);
    expect(invalidNumber.body.message).toEqual(enumErrorMatcher);
  });

  it('AC4: PATCH /tasks/:id with priority changes only priority and updatedAt', async () => {
    const server = app.getHttpServer();
    const created = await request(server)
      .post('/tasks')
      .send({ title: 'keep me', priority: 'medium' })
      .expect(201);
    const id: string = created.body.id;

    await new Promise((resolve) => setTimeout(resolve, 5));
    const updated = await request(server)
      .patch(`/tasks/${id}`)
      .send({ priority: 'low' })
      .expect(200);

    expect(updated.body).toMatchObject({
      id: created.body.id,
      title: created.body.title,
      done: created.body.done,
      createdAt: created.body.createdAt,
      priority: 'low',
    });
    expect(updated.body.updatedAt).not.toBe(created.body.updatedAt);
  });

  it('AC5: GET /tasks?priority=high returns only high-priority tasks, in creation order', async () => {
    const server = app.getHttpServer();
    const a = await request(server)
      .post('/tasks')
      .send({ title: 'a', priority: 'high' })
      .expect(201);
    await request(server).post('/tasks').send({ title: 'b', priority: 'low' }).expect(201);
    const c = await request(server)
      .post('/tasks')
      .send({ title: 'c', priority: 'high' })
      .expect(201);

    const res = await request(server).get('/tasks?priority=high').expect(200);

    expect(res.body.map((t: { id: string }) => t.id)).toEqual([a.body.id, c.body.id]);
  });

  it('AC6: GET /tasks?priority=bogus returns 400', async () => {
    const server = app.getHttpServer();
    await request(server).get('/tasks?priority=bogus').expect(400);
  });

  it('AC7: GET /tasks without the priority param still returns all tasks', async () => {
    const server = app.getHttpServer();
    await request(server).post('/tasks').send({ title: 'a', priority: 'low' }).expect(201);
    await request(server).post('/tasks').send({ title: 'b', priority: 'high' }).expect(201);

    const res = await request(server).get('/tasks').expect(200);

    expect(res.body).toHaveLength(2);
  });
});
