import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Task, TaskPriority } from './task.entity';

/**
 * In-memory store. Deliberately simple so the repo has no external dependencies;
 * swapping it for Postgres/Supabase is a good exercise spec.
 */
@Injectable()
export class TasksRepository {
  private readonly tasks = new Map<string, Task>();

  findAll(filter?: { priority?: TaskPriority }): Task[] {
    const tasks = [...this.tasks.values()].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    if (filter?.priority === undefined) return tasks;
    return tasks.filter((task) => task.priority === filter.priority);
  }

  findById(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  create(data: Pick<Task, 'title' | 'priority'>): Task {
    const now = new Date();
    const task: Task = {
      id: randomUUID(),
      title: data.title,
      done: false,
      priority: data.priority,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(task.id, task);
    return task;
  }

  update(
    id: string,
    changes: Partial<Pick<Task, 'title' | 'done' | 'priority'>>,
  ): Task | undefined {
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
