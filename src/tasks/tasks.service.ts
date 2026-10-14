import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task, TaskPriority } from './task.entity';
import { TasksRepository } from './tasks.repository';

@Injectable()
export class TasksService {
  constructor(private readonly repo: TasksRepository) {}

  list(query?: TaskQueryDto): Task[] {
    return this.repo.findAll({ priority: query?.priority });
  }

  get(id: string): Task {
    const task = this.repo.findById(id);
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  create(dto: CreateTaskDto): Task {
    return this.repo.create({
      title: dto.title.trim(),
      priority: dto.priority ?? TaskPriority.Medium,
    });
  }

  update(id: string, dto: UpdateTaskDto): Task {
    const changes: Partial<Pick<Task, 'title' | 'done' | 'priority'>> = {};
    if (dto.title !== undefined) changes.title = dto.title.trim();
    if (dto.done !== undefined) changes.done = dto.done;
    if (dto.priority !== undefined) changes.priority = dto.priority;
    const task = this.repo.update(id, changes);
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  remove(id: string): void {
    if (!this.repo.delete(id)) throw new NotFoundException(`Task ${id} not found`);
  }
}
