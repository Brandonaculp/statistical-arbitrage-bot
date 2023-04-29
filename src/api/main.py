from fastapi import FastAPI
from fastapi.responses import JSONResponse
from typing import List, Any
from statsmodels.tsa.stattools import coint
import statsmodels.api as sm
import pandas as pd
import numpy as np
import orjson


class ORJSONResponse(JSONResponse):
    media_type = "application/json"

    def render(self, content: Any) -> bytes:
        return orjson.dumps(content, option=orjson.OPT_SERIALIZE_NUMPY)


app = FastAPI(default_response_class=ORJSONResponse)


@app.post("/calculate_spread")
def calculate_spread(series1: List[float], series2: List[float], hedgeRatio: float):
    spread = pd.Series(series1) - (pd.Series(series2) * hedgeRatio)
    return spread


@app.post("/calculate_cointegration")
async def calculate_cointegration(series1: List[float], series2: List[float]):
    coint_flag = 0
    coint_res = coint(series1, series2)
    coint_t = coint_res[0]
    p_value = coint_res[1]
    critical_value = coint_res[2][1]
    model = sm.OLS(series1, series2).fit()
    hedge_ratio = model.params[0]
    spread = calculate_spread(series1, series2, hedge_ratio)
    zero_crossing = len(np.where(np.diff(np.sign(spread)))[0])
    if p_value < 0.5 and coint_t < critical_value:
        coint_flag = 1

    return {
        "cointFlag": coint_flag,
        "pValue": round(p_value, 2),
        "tValue": round(coint_t, 2),
        "criticalValue": round(critical_value, 2),
        "hedgeRatio": round(hedge_ratio, 2),
        "zeroCrossing": zero_crossing
    }
