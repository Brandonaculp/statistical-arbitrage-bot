import { MarketsResponseObject } from '@dydxprotocol/v3-client';
import { Processor, Process } from '@nestjs/bull';
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
