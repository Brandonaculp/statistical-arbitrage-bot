import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class ChannelValidationPipe implements PipeTransform {
  readonly allowedChannels = ['v3_orderbook', 'v3_trades'];

  transform(value: any) {
    if (!this.isValidChannel(value)) {
      throw new BadRequestException(
        `Invalid channel. Allowed channels are: ${this.allowedChannels.join(
          ', ',
        )}`,
      );
    }
    return value;
  }

  private isValidChannel(value: any): boolean {
    return this.allowedChannels.includes(value);
  }
}
