import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [TasksModule, HealthModule],
})
export class AppModule {}
