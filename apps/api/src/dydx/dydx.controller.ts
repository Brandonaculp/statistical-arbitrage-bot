import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/user/user.decorator';
import { SubscribeDto } from './dto';
import { ChannelValidationPipe } from './pipes';
import { DydxWebSocketClient } from './dydx.websocket';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from 'src/prisma/prisma.service';

@UseGuards(AuthGuard)
@Controller('dydx')
export class DydxController {
  constructor(
    private dydxWebSocket: DydxWebSocketClient,
    private prisma: PrismaService,
  ) {}

  @Post('subscribe/:channel')
  @ApiBearerAuth('access-token')
  async subscribe(
    @Param('channel', ChannelValidationPipe)
    channel: 'v3_orderbook' | 'v3_trades' | 'v3_accounts',
    @User() user: any,
    @Body() body: SubscribeDto,
  ) {
    const markets = body.markets
      ? await this.prisma.market.findMany({
          where: {
            name: { in: body.markets },
          },
        })
      : [];

    switch (channel) {
      case 'v3_accounts':
        this.dydxWebSocket.subscribeAccounts(user.id);
        break;
      case 'v3_orderbook':
        this.dydxWebSocket.subscribeOrderbook(...markets);
        break;
      case 'v3_trades':
        this.dydxWebSocket.subscribeOrderbook(...markets);
        break;
    }

    return { channel, subscribed: true };
  }
}
