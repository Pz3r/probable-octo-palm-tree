import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Task } from './task.entity';

/**
 * In-memory store. Deliberately simple so the repo has no external dependencies;
 * swapping it for Postgres/Supabase is a good exercise spec.
 */
@Injectable()
export class TasksRepository {
  private readonly tasks = new Map<string, Task>();

  findAll(): Task[] {
    return [...this.tasks.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  findById(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  create(data: Pick<Task, 'title'>): Task {
    const now = new Date();
    const task: Task = {
      id: randomUUID(),
      title: data.title,
      done: false,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(task.id, task);
    return task;
  }

  update(id: string, changes: Partial<Pick<Task, 'title' | 'done'>>): Task | undefined {
    const existing = this.tasks.get(id);
    if (!existing) return undefined;
    const updated: Task = { ...existing, ...changes, updatedAt: new Date() };
    this.tasks.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.tasks.delete(id);
  }
}
