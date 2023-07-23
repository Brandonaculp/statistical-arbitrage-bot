import { InjectQueue } from '@nestjs/bull';
import { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Market } from '@prisma/client';
import { Queue } from 'bull';
import { WebSocket } from 'ws';

export class DydxWebSocketClient implements OnModuleDestroy {
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

      await this.dydxQueue.add(data.channel, data, {
        removeOnComplete: true,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      });
    });
  }

  subscribeOrderbook(...markets: Market[]) {
    const sendOrderbookSubscription = () => {
      for (const market of markets) {
        const orderbookMessage = {
          type: 'subscribe',
          channel: 'v3_orderbook',
          id: market.name,
          includeOffsets: true,
        };
        this.ws.send(JSON.stringify(orderbookMessage));
      }
    };

    if (this.ws.readyState === WebSocket.OPEN) {
      sendOrderbookSubscription();
    } else {
      this.ws.on('open', sendOrderbookSubscription);
    }
  }

  subscribeTrades(...markets: Market[]) {
    const sendTradesSubscription = () => {
      for (const market of markets) {
        const tradesMessage = {
          type: 'subscribe',
          channel: 'v3_trades',
          id: market.name,
        };
        this.ws.send(JSON.stringify(tradesMessage));
      }
    };

    if (this.ws.readyState === WebSocket.OPEN) {
      sendTradesSubscription();
    } else {
      this.ws.on('open', sendTradesSubscription);
    }
  }

  onModuleDestroy() {
    this.ws.close();
  }
}
