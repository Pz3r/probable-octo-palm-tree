import { INestApplication, ValidationPipe } from '@nestjs/common';

/** Shared app configuration, used by main.ts and by e2e tests so they behave identically. */
export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
}
