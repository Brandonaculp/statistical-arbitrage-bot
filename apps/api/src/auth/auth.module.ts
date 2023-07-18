import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  providers: [AuthService],
  imports: [
    JwtModule.register({ global: true, signOptions: { expiresIn: '1d' } }),
  ],
  controllers: [AuthController],
})
export class AuthModule {}
