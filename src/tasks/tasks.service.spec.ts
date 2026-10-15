import { NotFoundException } from '@nestjs/common';
import { TaskPriority } from './task.entity';
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

  it('AC1: creates a task without priority defaulting to medium', () => {
    const task = service.create({ title: 'default priority' });
    expect(task.priority).toBe(TaskPriority.Medium);
  });

  it.each([TaskPriority.Low, TaskPriority.Medium, TaskPriority.High])(
    'AC2: creates a task with priority %s and stores that value',
    (priority) => {
      const task = service.create({ title: 'explicit priority', priority });
      expect(task.priority).toBe(priority);
    },
  );

  it('AC5: lists only tasks matching the given priority filter, in creation order', () => {
    const a = service.create({ title: 'a', priority: TaskPriority.High });
    service.create({ title: 'b', priority: TaskPriority.Low });
    const c = service.create({ title: 'c', priority: TaskPriority.High });

    const result = service.list({ priority: TaskPriority.High });

    expect(result.map((t) => t.id)).toEqual([a.id, c.id]);
  });

  it('AC7: lists all tasks when no priority filter is given', () => {
    const a = service.create({ title: 'a', priority: TaskPriority.Low });
    const b = service.create({ title: 'b', priority: TaskPriority.High });

    expect(service.list({}).map((t) => t.id)).toEqual([a.id, b.id]);
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
