import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import * as Joi from 'joi';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { DydxModule } from './dydx/dydx.module';
import { UserModule } from './user/user.module';

const configSchema = Joi.object({
  DATABASE_URL: Joi.string().required(),
  PROVIDER_URL: Joi.string().required(),
  DYDX_HTTP_HOST: Joi.string().required(),
  DYDX_WS_HOST: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
});

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    ConfigModule.forRoot({ validationSchema: configSchema, isGlobal: true }),
    PrismaModule,
    AuthModule,
    DydxModule,
    UserModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
