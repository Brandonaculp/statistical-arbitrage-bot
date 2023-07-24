import { DydxClient } from '@dydxprotocol/v3-client';
import { RequestMethod } from '@dydxprotocol/v3-client/build/src/lib/axios';
import { InjectQueue } from '@nestjs/bull';
import { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Market } from '@prisma/client';
import { Queue } from 'bull';
import { PrismaService } from 'src/prisma/prisma.service';
import Web3 from 'web3';
import { WebSocket } from 'ws';

export class DydxWebSocketClient implements OnModuleDestroy {
  private ws: WebSocket;

  constructor(
    @InjectQueue('dydx') readonly dydxQueue: Queue,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.ws = new WebSocket(this.config.get('DYDX_WS_HOST') as string);

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

  subscribeAccounts(userId: string) {
    const sendAccountsSubscription = async () => {
      const user = await this.prisma.user.findFirstOrThrow({
        where: { id: userId },
        include: {
          apiKey: true,
        },
      });

      const web3 = new Web3(
        new Web3.providers.HttpProvider(
          this.config.get('PROVIDER_URL') as string,
        ),
      );
      const client = new DydxClient(
        this.config.get('DYDX_HTTP_HOST') as string,
        {
          // @ts-expect-error: web3 version
          web3,
          apiKeyCredentials: user.apiKey || undefined,
        },
      );
      web3.eth.accounts.wallet.add(user.privateKey);

      const timestamp = new Date().toISOString();
      const signature = client.private.sign({
        requestPath: '/ws/accounts',
        method: RequestMethod.GET,
        isoTimestamp: timestamp,
      });

      const accountsMessage = {
        type: 'subscribe',
        channel: 'v3_accounts',
        accountNumber: '0',
        apiKey: user.apiKey?.key,
        signature,
        timestamp,
        passphrase: user.apiKey?.passphrase,
      };
      this.ws.send(JSON.stringify(accountsMessage));
    };

    if (this.ws.readyState === WebSocket.OPEN) {
      sendAccountsSubscription();
    } else {
      this.ws.on('open', sendAccountsSubscription);
    }
  }

  onModuleDestroy() {
    this.ws.close();
  }
}
