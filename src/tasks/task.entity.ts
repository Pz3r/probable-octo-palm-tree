export enum TaskPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

export interface Task {
  id: string;
  title: string;
  done: boolean;
  priority: TaskPriority;
  createdAt: Date;
  updatedAt: Date;
}
