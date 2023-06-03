from statsmodels.tsa.stattools import coint
import statsmodels.api as sm
from typing import List
import pandas as pd
import numpy as np


def calculate_zscore(spread, window):
    df = pd.DataFrame(spread)
    mean = df.rolling(center=False, window=window).mean()
    std = df.rolling(center=False, window=window).std()
    x = df.rolling(center=False, window=1).mean()
    df['ZScore'] = (x - mean) / std
    return df['ZScore'].astype(float).values


def calculate_spread(series1: List[float], series2: List[float], hedgeRatio: float):
    spread = pd.Series(series1) - (pd.Series(series2) * hedgeRatio)
    return spread


def calculate_cointegration(series1: List[float], series2: List[float], window: int):
    coint_flag = False
    coint_res = coint(series1, series2)
    coint_t = coint_res[0]
    p_value = coint_res[1]
    critical_value = coint_res[2][1]
    model = sm.OLS(series1, series2).fit()
    hedge_ratio = model.params[0]
    spread = calculate_spread(series1, series2, hedge_ratio)
    zero_crossing = len(np.where(np.diff(np.sign(spread)))[0])
    zscore_list = calculate_zscore(spread, window=window)
    if p_value < 0.5 and coint_t < critical_value:
        coint_flag = True

    return {
        "cointFlag": coint_flag,
        "pValue": round(p_value, 2),
        "tValue": round(coint_t, 2),
        "criticalValue": round(critical_value, 2),
        "hedgeRatio": round(hedge_ratio, 2),
        "zeroCrossing": zero_crossing,
        "zscoreList": zscore_list.tolist()
    }
