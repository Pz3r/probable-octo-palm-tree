import { readFileSync } from 'fs';
import { join } from 'path';
import { HealthService } from './health.service';

const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8')) as {
  version: string;
};

describe('HealthService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('AC1: returns status "ok"', () => {
    const service = new HealthService();
    expect(service.check().status).toBe('ok');
  });

  it('AC2: uptimeSeconds is a non-negative integer that increases over time', () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    const service = new HealthService();

    const first = service.check();
    expect(Number.isInteger(first.uptimeSeconds)).toBe(true);
    expect(first.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(first.uptimeSeconds).toBe(0);

    jest.advanceTimersByTime(5000);
    const second = service.check();
    expect(second.uptimeSeconds).toBe(5);
    expect(second.uptimeSeconds).toBeGreaterThan(first.uptimeSeconds);
  });

  it('AC3: version equals the version field in package.json', () => {
    const service = new HealthService();
    expect(service.check().version).toBe(packageJson.version);
  });

  it('AC4: response contains exactly status, uptimeSeconds and version', () => {
    const service = new HealthService();
    expect(Object.keys(service.check()).sort()).toEqual(
      ['status', 'uptimeSeconds', 'version'].sort(),
    );
  });
});
