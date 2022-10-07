import dotenv from "dotenv";

dotenv.config();

interface ENV {
  CANDLES_LIMIT: number | undefined;
}

interface Config {
  CANDLES_LIMIT: number;
}

//TODO: Maybe validators
const getConfig = (): ENV => {
  return {
    CANDLES_LIMIT: process.env.CANDLES_LIMIT
      ? Number(process.env.CANDLES_LIMIT)
      : 100,
  };
};

const getSanitizedConfig = (config: ENV): Config => {
  for (const [key, value] of Object.entries(config)) {
    if (value === undefined) {
      throw new Error(`Missing key ${key} in env`);
    }
  }
  return config as Config;
};

const config = getConfig();
const sanitizedConfig = getSanitizedConfig(config);
export default sanitizedConfig;
