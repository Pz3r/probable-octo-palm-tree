import { IsEnum, IsOptional } from 'class-validator';
import { TaskPriority } from '../task.entity';

export class TaskQueryDto {
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;
}
