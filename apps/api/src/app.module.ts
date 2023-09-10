import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { DydxModule } from './dydx/dydx.module';
import { UserModule } from './user/user.module';
import { CointModule } from './coint/coint.module';
import { configSchema } from './config';

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
    CointModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
