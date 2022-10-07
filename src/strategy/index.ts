import getMarkets from "./utils/getMarkets";
import getMarketsPrices from "./utils/getMarketsPrices";
import { writeFile } from "fs/promises";

async function main() {
  console.log("[+]Fetching markets");
  const markets = await getMarkets();

  console.log("[+]Fetching markets prices");
  const prices = await getMarketsPrices(markets);

  await writeFile("marketPrices.json", JSON.stringify(prices), "utf-8");
}

main().catch((error) => {
  console.error(error);
});
