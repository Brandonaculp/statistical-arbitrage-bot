import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { User } from 'src/user/user.decorator';
import { SubscribeDto } from './dto';
import { ChannelValidationPipe } from './pipes';

@UseGuards(AuthGuard)
@Controller('dydx')
export class DydxController {
  @Post('subscribe/:channel')
  subscribe(
    @Param('channel', ChannelValidationPipe) channel: string,
    @User() user: any,
    @Body() body: SubscribeDto,
  ) {
    return { channel };
  }
}
