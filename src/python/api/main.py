from fastapi import FastAPI
from fastapi.responses import JSONResponse
from typing import List, Any
from pydantic import BaseModel
from ..cointegration import calculate_cointegration
import orjson


class ORJSONResponse(JSONResponse):
    media_type = "application/json"

    def render(self, content: Any) -> bytes:
        return orjson.dumps(content, option=orjson.OPT_SERIALIZE_NUMPY | orjson.OPT_NON_STR_KEYS)


app = FastAPI(default_response_class=ORJSONResponse)


class CalculateCointegrationBody(BaseModel):
    series1: List[float]
    series2: List[float]


@app.post("/calculate_cointegration")
async def calculate_cointegration_endpoint(body: CalculateCointegrationBody):
    return calculate_cointegration(body.series1, body.series2)
