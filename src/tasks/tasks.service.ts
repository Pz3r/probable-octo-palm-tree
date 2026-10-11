import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task } from './task.entity';
import { TasksRepository } from './tasks.repository';

@Injectable()
export class TasksService {
  constructor(private readonly repo: TasksRepository) {}

  list(): Task[] {
    return this.repo.findAll();
  }

  get(id: string): Task {
    const task = this.repo.findById(id);
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  create(dto: CreateTaskDto): Task {
    return this.repo.create({ title: dto.title.trim() });
  }

  update(id: string, dto: UpdateTaskDto): Task {
    const changes = { ...dto, ...(dto.title !== undefined && { title: dto.title.trim() }) };
    const task = this.repo.update(id, changes);
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  remove(id: string): void {
    if (!this.repo.delete(id)) throw new NotFoundException(`Task ${id} not found`);
  }
}
