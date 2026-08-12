import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppService } from './app.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*', // Adjust for production
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.setGlobalPrefix('api');

  // Explicitly map the root path to bypass the global prefix 
  // so the domain root always returns the health check.
  app.getHttpAdapter().get('/', async (req: any, res: any) => {
    const service = app.get(AppService);
    res.send(await service.healthCheck());
  });

  const port = process.env.PORT || 3002;
  await app.listen(port);
  console.log(`Admin Backend is running on port: ${port}`);
}
bootstrap();
