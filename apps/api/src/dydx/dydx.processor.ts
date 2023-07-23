import {
  AccountResponseObject,
  MarketsResponseObject,
  OrderResponseObject,
  OrderStatus,
  PositionResponseObject,
  PositionStatus,
} from '@dydxprotocol/v3-client';
import { Processor, Process } from '@nestjs/bull';
import {
  ActiveOrderSide,
  ActiveOrderStatus,
  ActiveOrderType,
  PositionSide,
} from '@prisma/client';
import { Job } from 'bull';
import { PrismaService } from 'src/prisma/prisma.service';

@Processor('dydx')
export class DydxProcessor {
  constructor(private prisma: PrismaService) {}

  @Process('v3_markets')
  async handleMarkets(job: Job) {
    let markets: MarketsResponseObject;

    if (job.data.type === 'subscribed') {
      markets = job.data.contents.markets as MarketsResponseObject;

      await this.prisma.market.createMany({
        data: this.parseMarketsResponse(markets),
      });

      return;
    }

    markets = job.data.contents;

    for (const { name, indexPrice } of this.parseMarketsResponse(markets)) {
      await this.prisma.market.update({
        where: {
          name,
        },
        data: {
          indexPrice,
        },
      });
    }
  }

  @Process('v3_accounts')
  async handleAccounts(job: Job) {
    const accountId: string = job.data.id;

    if (job.data.type === 'subscribed') {
      const { account, orders } = job.data.contents as {
        orders: OrderResponseObject[];
        account: AccountResponseObject;
      };

      for (const order of orders) {
        if (
          order.status === OrderStatus.CANCELED ||
          order.status === OrderStatus.FILLED
        ) {
          continue;
        }

        const market = await this.prisma.market.findFirstOrThrow({
          where: { name: order.market },
        });

        await this.prisma.activeOrder.create({
          data: {
            id: order.id,
            size: parseFloat(order.size),
            remainingSize: parseFloat(order.remainingSize),
            price: parseFloat(order.price),
            side: order.side as ActiveOrderSide,
            status: order.status as ActiveOrderStatus,
            type: order.type as ActiveOrderType,
            accountId,
            marketId: market.id,
          },
        });
      }

      await this.prisma.account.update({
        where: {
          id: account.id,
        },
        data: {
          quoteBalance: parseFloat(account.quoteBalance),
        },
      });

      for (const [marketName, position] of Object.entries(
        account.openPositions,
      )) {
        const market = await this.prisma.market.findFirstOrThrow({
          where: { name: marketName },
        });

        await this.prisma.position.create({
          data: {
            id: position.id,
            size: parseFloat(position.size),
            side: position.side as PositionSide,
            accountId,
            marketId: market.id,
          },
        });
      }

      return;
    }

    const { positions, orders, accounts } = job.data.contents as {
      positions?: PositionResponseObject[];
      orders?: OrderResponseObject[];
      accounts?: AccountResponseObject[];
    };

    if (!!accounts) {
      const account = accounts[0];
      await this.prisma.account.update({
        where: {
          id: accountId,
        },
        data: {
          quoteBalance: parseFloat(account.quoteBalance),
        },
      });
    }

    if (!!orders) {
      for (const order of orders) {
        if (
          order.status === OrderStatus.CANCELED ||
          order.status === OrderStatus.FILLED
        ) {
          await this.prisma.activeOrder.delete({
            where: { id: order.id },
          });

          continue;
        }

        const market = await this.prisma.market.findFirstOrThrow({
          where: { name: order.market },
        });

        await this.prisma.activeOrder.upsert({
          where: {
            id: order.id,
          },
          create: {
            id: order.id,
            size: parseFloat(order.size),
            remainingSize: parseFloat(order.remainingSize),
            price: parseFloat(order.price),
            side: order.side as ActiveOrderSide,
            status: order.status as ActiveOrderStatus,
            type: order.type as ActiveOrderType,
            accountId,
            marketId: market.id,
          },
          update: {
            remainingSize: parseFloat(order.remainingSize),
            status: order.status as ActiveOrderStatus,
          },
        });
      }
    }

    if (!!positions) {
      for (const position of positions) {
        const market = await this.prisma.market.findFirstOrThrow({
          where: {
            name: position.market,
          },
        });

        if (position.status === PositionStatus.CLOSED) {
          await this.prisma.position.delete({
            where: {
              marketId: market.id,
            },
          });
        } else {
          const size = parseFloat(position.size);

          await this.prisma.position.upsert({
            where: {
              marketId: market.id,
            },
            create: {
              id: position.id,
              size,
              side: position.side as PositionSide,
              accountId,
              marketId: market.id,
            },
            update: {
              size,
            },
          });
        }
      }
    }
  }

  private parseMarketsResponse(markets: MarketsResponseObject) {
    return Object.entries(markets)
      .filter((v) => !!v[1].indexPrice)
      .map(([name, marketData]) => {
        const indexPrice = parseFloat(marketData.indexPrice);

        return {
          name,
          indexPrice,
        };
      });
  }
}
