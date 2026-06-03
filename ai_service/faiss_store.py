import faiss
import numpy as np

class VectorStore:
    def __init__(self):
        # Khởi tạo 2 Index trống để test.
        # Thực tế bạn sẽ dùng: self.clip_index = faiss.read_index("data/openclip.index")
        self.clip_index = faiss.IndexFlatIP(512) 
        self.vit_index = faiss.IndexFlatIP(256)
        
        # Map ID giả lập để test
        self.dummy_ids = [f"prod_00{i}" for i in range(1, 4)]
        
        # Add dummy vectors để search không bị rỗng
        self.clip_index.add(np.random.rand(3, 512).astype('float32'))
        self.vit_index.add(np.random.rand(3, 256).astype('float32'))

    def search_openclip(self, query_vector, top_k=100):
        """Tìm kiếm Phase 1 (Retrieval)"""
        # Giới hạn top_k không vượt quá tổng số vector hiện có
        k = min(top_k, self.clip_index.ntotal)
        if k == 0: return []
        
        distances, indices = self.clip_index.search(query_vector, k)
        
        results = []
        for i, idx in enumerate(indices[0]):
            if idx != -1 and idx < len(self.dummy_ids):
                results.append({
                    "product_id": self.dummy_ids[idx],
                    "retrieval_score": float(distances[0][i])
                })
        return results

    def search_vit(self, target_vector, top_k=20):
        """Tìm kiếm Similar Products trực tiếp"""
        k = min(top_k, self.vit_index.ntotal)
        if k == 0: return []
        
        distances, indices = self.vit_index.search(target_vector, k)
        
        results = []
        for i, idx in enumerate(indices[0]):
            if idx != -1 and idx < len(self.dummy_ids):
                results.append({
                    "product_id": self.dummy_ids[idx],
                    "retrieval_score": float(distances[0][i])
                })
        return results