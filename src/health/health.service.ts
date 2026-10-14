import { Injectable } from '@nestjs/common';
import { version } from '../../package.json';
import { HealthStatus } from './health.entity';

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  check(): HealthStatus {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      version,
    };
  }
}
