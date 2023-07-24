import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/user/user.decorator';
import { SubscribeDto } from './dto';
import { ChannelValidationPipe } from './pipes';
import { DydxWebSocketClient } from './dydx.websocket';

@UseGuards(AuthGuard)
@Controller('dydx')
export class DydxController {
  constructor(private dydxWebSocket: DydxWebSocketClient) {}

  @Post('subscribe/:channel')
  subscribe(
    @Param('channel', ChannelValidationPipe) channel: string,
    @User() user: any,
    @Body() body: SubscribeDto,
  ) {
    switch (channel) {
      case 'v3_accounts':
        this.dydxWebSocket.subscribeAccounts(user.id);
        break;
      default:
        console.log('not supported channel');
    }

    return { channel, subscribed: true };
  }
}
