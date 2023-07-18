import { ForbiddenException, Injectable } from '@nestjs/common';
import * as argon from 'argon2';
import { PrismaService } from 'src/prisma/prisma.service';
import { SignupDto } from './dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async signup({ username, password, privateKey }: SignupDto) {
    const hashedPassword = await argon.hash(password);

    const userExists = await this.prisma.user.findFirst({
      where: { OR: [{ username }, { privateKey }] },
    });

    if (!!userExists) {
      throw new ForbiddenException('Credentials taken');
    }

    const user = await this.prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        privateKey,
      },
    });

    return this.signToken(user.id);
  }

  async signToken(userId: string) {
    const payload = { sub: userId };
    const secret = this.config.get('JWT_SECRET');
    const token = await this.jwt.signAsync(payload, { secret });

    return {
      access_token: token,
    };
  }
}
