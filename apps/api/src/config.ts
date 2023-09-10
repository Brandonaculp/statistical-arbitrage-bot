import * as Joi from 'joi';

export const configSchema = Joi.object({
  DATABASE_URL: Joi.string().required(),
  PROVIDER_URL: Joi.string().required(),
  DYDX_HTTP_HOST: Joi.string().required(),
  DYDX_WS_HOST: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  CANDLE_RESOLUTION: Joi.string()
    .valid('1DAY', '4HOURS', '1HOUR', '30MINS', '15MINS', '5MINS', '1MIN')
    .required(),
  CANDLE_LIMIT: Joi.number().max(100).required(),
  Z_SCORE_WINDOW: Joi.number().required(),
});

export interface Config {
  DATABASE_URL: string;
  PROVIDER_URL: string;
  DYDX_HTTP_HOST: string;
  DYDX_WS_HOST: string;
  JWT_SECRET: string;
  CANDLE_RESOLUTION:
    | '1DAY'
    | '4HOURS'
    | '1HOUR'
    | '30MINS'
    | '15MINS'
    | '5MINS'
    | '1MIN';
  CANDLE_LIMIT: number;
  Z_SCORE_WINDOW: number;
}
