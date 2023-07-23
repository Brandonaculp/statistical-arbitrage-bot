import { InjectQueue } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { WebSocket } from 'ws';

export class DydxWebSocketClient {
  private ws: WebSocket;

  constructor(
    @InjectQueue('dydx') readonly dydxQueue: Queue,
    config: ConfigService,
  ) {
    this.ws = new WebSocket(config.get('DYDX_WS_HOST') as string);

    const marketsMessage = {
      type: 'subscribe',
      channel: 'v3_markets',
    };

    this.ws.on('open', () => {
      this.ws.send(JSON.stringify(marketsMessage));
    });

    this.ws.on('message', async (rawData) => {
      const data = JSON.parse(rawData.toString());

      // TODO: check if data.channel can be undefined or an empty string
      if (data.channel !== '') {
        await this.dydxQueue.add(data.channel, data, {
          removeOnComplete: true,
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        });
      }
    });
  }
}
