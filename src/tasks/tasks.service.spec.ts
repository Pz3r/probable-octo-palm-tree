import { NotFoundException } from '@nestjs/common';
import { TasksRepository } from './tasks.repository';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;

  beforeEach(() => {
    service = new TasksService(new TasksRepository());
  });

  it('creates a task with a trimmed title and done=false', () => {
    const task = service.create({ title: '  Write spec  ' });
    expect(task.title).toBe('Write spec');
    expect(task.done).toBe(false);
  });

  it('lists tasks in creation order', () => {
    const a = service.create({ title: 'a' });
    const b = service.create({ title: 'b' });
    expect(service.list().map((t) => t.id)).toEqual([a.id, b.id]);
  });

  it('updates done and title', () => {
    const task = service.create({ title: 'old' });
    const updated = service.update(task.id, { title: ' new ', done: true });
    expect(updated).toMatchObject({ title: 'new', done: true });
  });

  it('throws NotFound for unknown ids', () => {
    const id = '00000000-0000-4000-8000-000000000000';
    expect(() => service.get(id)).toThrow(NotFoundException);
    expect(() => service.update(id, { done: true })).toThrow(NotFoundException);
    expect(() => service.remove(id)).toThrow(NotFoundException);
  });

  it('removes a task', () => {
    const task = service.create({ title: 'x' });
    service.remove(task.id);
    expect(service.list()).toHaveLength(0);
  });
});
