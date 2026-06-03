from pydantic import BaseModel, Field
from typing import List, Optional

class SearchRequest(BaseModel):
    query: Optional[str] = None
    image_base64: Optional[str] = None
    top_k: int = Field(default=20, ge=1, le=100) # Giới hạn 1-100 để chống spam

class SearchResultItem(BaseModel):
    product_id: str
    score: float

class SearchResponse(BaseModel):
    results: List[SearchResultItem]
    inference_time_ms: float