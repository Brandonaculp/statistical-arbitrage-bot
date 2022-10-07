import {
  MarketResponseObject,
  CandleResponseObject,
} from "@dydxprotocol/v3-client";
import getCandlesForMarket from "./getCandlesForMarket";
import retry from "../../utils/retry";
import config from "../../../config";

interface MarketsPrices {
  [market: string]: CandleResponseObject[];
}

export default async function getMarketsPrices(markets: {
  [market: string]: MarketResponseObject;
}) {
  const marketsPrices: MarketsPrices = {};

  const promises = Object.keys(markets).map((market) =>
    retry(getCandlesForMarket, [market], 1)
      .then((marketPrices) => {
        if (marketPrices.length === config.CANDLES_LIMIT) {
          marketsPrices[market] = marketPrices;
        }
      })
      .catch((e) => {
        console.log(`[-]Failed to fetch ${market} market prices.`);
      })
  );

  await Promise.all(promises);

  return marketsPrices;
}
