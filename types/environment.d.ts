declare global {
  namespace NodeJS {
    interface ProcessEnv {
      CANDLES_LIMIT: number;
    }
  }
}

export {};
