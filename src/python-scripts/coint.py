from statsmodels.tsa.stattools import coint
import statsmodels.api as sm
import pandas as pd
import numpy as np
import sys
import json


def calculate_spread(series_1, series_2, hedge_ratio):
    spread = pd.DataFrame(series_1) - (pd.Series(series_2) * hedge_ratio)
    return spread


def calculate_cointegration(series_1, series_2):
    coint_flag = 0
    coint_res = coint(series_1, series_2)
    coint_t = coint_res[0]
    p_value = coint_res[1]
    critical_value = coint_res[2][1]
    model = sm.OLS(series_1, series_2).fit()
    hedge_ratio = model.params[0]
    spread = calculate_spread(series_1, series_2, hedge_ratio)
    zero_crossing = len(np.where(np.diff(np.sign(spread)))[0])
    if p_value < 0.5 and coint_t < critical_value:
        coint_flag = 1

    return (coint_flag, round(p_value, 2), round(coint_t, 2), round(critical_value, 2), round(hedge_ratio, 2), zero_crossing)


if __name__ == "__main__":
    series_1 = json.loads(sys.argv[1])
    series_2 = json.loads(sys.argv[2])
    print(calculate_cointegration(series_1, series_2))
