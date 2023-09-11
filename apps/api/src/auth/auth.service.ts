import { ForbiddenException, Injectable } from '@nestjs/common';
import * as argon from 'argon2';
import { PrismaService } from 'src/prisma/prisma.service';
import { SigninDto, SignupDto } from './dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DydxService } from 'src/dydx/dydx.service';
import { Config } from 'src/config';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService<Config, true>,
    private dydx: DydxService,
  ) {}

  async signup({ username, password, privateKey }: SignupDto) {
    const hashedPassword = await argon.hash(password);

    const userExists = await this.prisma.user.findFirst({
      where: { OR: [{ username }, { privateKey }] },
    });

    if (!!userExists) {
      throw new ForbiddenException('Credentials taken');
    }

    const { keyPair, apiKey, accountId } = await this.dydx.getOrCreateUser(
      privateKey,
    );

    const user = await this.prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        privateKey,
        apiKey: {
          create: { ...apiKey },
        },
        account: {
          create: {
            id: accountId,
            starkKey: {
              create: {
                ...keyPair,
              },
            },
          },
        },
      },
    });

    const access_token = await this.signToken(user.id);
    return { user, access_token };
  }

  async signin({ username, password }: SigninDto) {
    const user = await this.prisma.user.findFirst({
      where: { username },
    });

    if (!user) {
      throw new ForbiddenException('Credentials incorrect');
    }

    const passwordMatch = await argon.verify(user.password, password);

    if (!passwordMatch) {
      throw new ForbiddenException('Credentials incorrect');
    }

    const access_token = await this.signToken(user.id);
    return { user, access_token };
  }

  private async signToken(userId: string) {
    const payload = { sub: userId };
    const secret = this.config.get('JWT_SECRET');
    const token = await this.jwt.signAsync(payload, { secret });

    return token;
  }
}
