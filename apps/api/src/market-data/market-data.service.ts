import { Injectable } from '@nestjs/common';
import { DydxService } from 'src/dydx/dydx.service';

@Injectable()
export class MarketDataService {
  constructor(private readonly dydx: DydxService) {}

  async getTradeableMarkets() {
    const client = this.dydx.getPublicClient();
    const { markets } = await client.public.getMarkets();

    return markets;
  }
}
