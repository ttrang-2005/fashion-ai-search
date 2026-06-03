from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import faiss
import numpy as np
import os
from ai_core import AIEngine
from contextlib import asynccontextmanager

app = FastAPI()
engine = AIEngine()

# ==========================================
# 1. LOAD DỮ LIỆU FAISS & ID SẢN PHẨM
# ==========================================
base_dir = os.path.dirname(os.path.abspath(__file__))
data_dir = os.path.join(base_dir, "data")

try:
    print("[FastAPI] Đang nạp não bộ FAISS...")
    clip_index = faiss.read_index(os.path.join(data_dir, "openclip.index"))
    product_ids = np.load(os.path.join(data_dir, "product_ids.npy"), allow_pickle=True)
    print(f"[FastAPI] Đã sẵn sàng {clip_index.ntotal} ảnh trong RAM!")
except Exception as e:
    print(f"[LỖI NGHIÊM TRỌNG] Không thể load FAISS. Bạn đã chạy ingest_fast.py chưa? Lỗi: {e}")
    clip_index = None

import threading

# Khởi động Model khi server chạy
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- NHỮNG VIỆC LÀM KHI BẬT SERVER ---
    print("\n[FastAPI] Đang khởi động hệ thống...")
    
    # KÍCH HOẠT NẠP MÔ HÌNH AI TRONG BACKGROUND THREAD (Tránh block port binding)
    def load_in_background():
        try:
            engine.load_models() 
            print("[FastAPI] Hệ thống đã sẵn sàng nhận truy vấn!\n")
        except Exception as e:
            print(f"[FastAPI LỖI NẠP MODEL] Lỗi: {e}")
            
    threading.Thread(target=load_in_background, daemon=True).start()
    
    yield # Điểm dừng, Server bắt đầu phục vụ người dùng
    
    # --- NHỮNG VIỆC LÀM KHI TẮT SERVER ---
    print("\n[FastAPI] Đang giải phóng bộ nhớ RAM...")
    import gc
    import torch
    # Xóa sạch RAM và VRAM GPU
    engine.clip_model = None
    engine.vit_model = None
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    gc.collect()
    print("[FastAPI] Đã dọn dẹp xong. Tạm biệt!\n")

# Nhúng vòng đời lifespan vào khi khởi tạo app
app = FastAPI(lifespan=lifespan)

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "clip_model_loaded": engine.clip_model is not None,
        "clip_model_type": type(engine.clip_model).__name__ if engine.clip_model else None,
        "vit_model_loaded": engine.vit_model is not None,
        "vit_model_type": type(engine.vit_model).__name__ if engine.vit_model else None,
        "device": engine.device
    }

# ==========================================
# 2. API ENDPOINT (Lắng nghe Node.js gọi)
# ==========================================
class SearchRequest(BaseModel):
    query: Optional[str] = None
    image_base64: Optional[str] = None
    top_k: int = 20

class SimilarRequest(BaseModel):
    product_id: str
    top_k: int = 20

@app.post("/search/hybrid")
def search_hybrid(req: SearchRequest):
    if engine.clip_model is None or engine.vit_model is None:
        raise HTTPException(status_code=503, detail="Mô hình AI đang được tải, vui lòng thử lại sau giây lát...")

    if clip_index is None:
        raise HTTPException(status_code=500, detail="FAISS Index chưa được load")

    # 1. Biến chữ (hoặc ảnh) thành Vector
    vec = engine.encode_query(text=req.query, image_base64=req.image_base64)
    
    # Chuẩn hóa L2 (Bắt buộc cho Inner Product)
    faiss.normalize_L2(vec)

    # 2. Tìm kiếm trong kho 50.000 ảnh
    distances, indices = clip_index.search(vec, req.top_k)

    # 3. Gói gọn kết quả gửi về Node.js
    results = []
    for i in range(len(indices[0])):
        idx = indices[0][i]
        if idx != -1:  # Nếu tìm thấy
            results.append({
                "product_id": str(product_ids[idx]),
                "score": float(distances[0][i])
            })

    return {"results": results}

@app.get("/search/similar")
def search_similar(product_id: str, top_k: int = 20):
    """Find similar products based on product_id"""
    if engine.clip_model is None or engine.vit_model is None:
        raise HTTPException(status_code=503, detail="Mô hình AI đang được tải, vui lòng thử lại sau giây lát...")

    if clip_index is None:
        raise HTTPException(status_code=500, detail="FAISS Index chưa được load")

    try:
        # Find the index of the product_id in product_ids array
        product_ids_list = product_ids.tolist() if isinstance(product_ids, np.ndarray) else list(product_ids)
        
        # Try to find the product_id
        try:
            product_idx = product_ids_list.index(product_id)
        except ValueError:
            # If product_id is not found, return empty results
            return {"results": []}
        
        # Get the vector for this product from the FAISS index
        # We need to get the vector - but FAISS doesn't have a direct get method
        # Instead, we'll use a trick: search for the product itself
        # For now, return empty results if product not found
        # In a production system, you'd store vectors separately
        
        # Return similar products by searching with a distance threshold
        distances, indices = clip_index.search(clip_index.reconstruct(product_idx).reshape(1, -1), top_k + 1)
        
        results = []
        for i in range(len(indices[0])):
            idx = indices[0][i]
            # Skip the product itself (first result will be itself with distance 0)
            if idx != -1 and idx != product_idx:
                results.append({
                    "product_id": str(product_ids_list[idx]),
                    "score": float(distances[0][i])
                })
        
        # Return top_k results (excluding the product itself)
        return {"results": results[:top_k]}
        
    except Exception as e:
        print(f"[Error in search_similar] {e}")
        return {"results": []}