import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { DydxModule } from './dydx/dydx.module';

const configSchema = Joi.object({
  DATABASE_URL: Joi.string().required(),
  PROVIDER_URL: Joi.string().required(),
  DYDX_HTTP_HOST: Joi.string().required(),
  DYDX_WS_HOST: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
});

@Module({
  imports: [
    ConfigModule.forRoot({ validationSchema: configSchema, isGlobal: true }),
    PrismaModule,
    AuthModule,
    DydxModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
