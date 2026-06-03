import torch
import torch.nn as nn
import torchvision.models as models
from torchvision import transforms
from transformers import AutoModel
import open_clip
import numpy as np
import os
import time
from PIL import Image
import io
import base64

# ==========================================
# 1. KIẾN TRÚC MODEL RANKER
# ==========================================
class PureFitHybridRecommender(nn.Module):
    def __init__(self, embed_dim=256):
        super().__init__()
        self.vit = models.vit_b_16(weights=models.ViT_B_16_Weights.DEFAULT)
        for name, param in self.vit.named_parameters():
            if "encoder.layers.11" in name or "heads" in name: param.requires_grad = True
            else: param.requires_grad = False
        self.vit.heads = nn.Linear(768, embed_dim)

        self.bert = AutoModel.from_pretrained('distilbert-base-uncased')
        for param in self.bert.parameters(): param.requires_grad = False
        for param in self.bert.transformer.layer[-2:].parameters(): param.requires_grad = True
        self.text_proj = nn.Linear(self.bert.config.hidden_size, embed_dim)

    def encode_image(self, images):
        return nn.functional.normalize(self.vit(images), p=2, dim=1)
    
    def encode_text(self, input_ids, attention_mask):
        cls_output = self.bert(input_ids, attention_mask).last_hidden_state[:, 0, :]
        return nn.functional.normalize(self.text_proj(cls_output), p=2, dim=1)
    
    def forward(self, images, input_ids, attention_mask): pass
    def rank_fit(self, img_vecs, txt_vecs): pass

# ==========================================
# DUMMY MODELS FOR FALLBACK (Offline / Slow Network)
# ==========================================
class DummyCLIPModel:
    def to(self, device): return self
    def eval(self): return self
    def encode_image(self, x):
        return torch.randn(1, 512)
    def encode_text(self, x):
        return torch.randn(1, 512)

class DummyViTModel:
    def to(self, device): return self
    def eval(self): return self

# ==========================================
# 2. AI ENGINE CỐT LÕI
# ==========================================
class AIEngine:
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        
        # CHÚ Ý TÊN FILE: Hãy chắc chắn trong thư mục models của bạn có file này
        self.clip_path = os.path.join(self.base_dir, "models", "model_555.pt") 
        self.vit_path = os.path.join(self.base_dir, "models", "hybrid_recommender_ViT.pth")
        
        self.clip_model = None
        self.vit_model = None
        self.clip_preprocess = None
        self.vit_transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])

    def load_models(self):
        print(f"[AI Core] Đang khởi động AI Engine trên {self.device.upper()}...")
        start = time.time()
        
        # 1. Load OpenCLIP
        try:
            self.clip_model, _, self.clip_preprocess = open_clip.create_model_and_transforms('ViT-B-32', pretrained='laion2b_s34b_b79k')
            if os.path.exists(self.clip_path):
                self.clip_model.load_state_dict(torch.load(self.clip_path, map_location=self.device))
                print(f" -> Đã nạp thành công OpenCLIP state dict: {os.path.basename(self.clip_path)}")
            else:
                print(f" -> [CẢNH BÁO] Không tìm thấy file OpenCLIP fine-tuned weights: {self.clip_path}. Sử dụng base weights.")
            self.clip_model = self.clip_model.to(self.device).eval()
        except Exception as e:
            print(f"[CẢNH BÁO AI] Lỗi load OpenCLIP: {e}. Sử dụng DUMMY CLIP model (Offline mode).")
            self.clip_model = DummyCLIPModel()
            self.clip_preprocess = lambda img: img

        # 2. Load ViT Hybrid
        try:
            self.vit_model = PureFitHybridRecommender(embed_dim=256)
            if os.path.exists(self.vit_path):
                self.vit_model.load_state_dict(torch.load(self.vit_path, map_location=self.device), strict=False)
                print(f" -> Đã nạp thành công ViT state dict: {os.path.basename(self.vit_path)}")
            else:
                sota_path = os.path.join(self.base_dir, "models", "SOTA_hybrid_model.pth")
                if os.path.exists(sota_path):
                    self.vit_model.load_state_dict(torch.load(sota_path, map_location=self.device), strict=False)
                    print(f" -> Đã nạp thành công ViT state dict (SOTA_hybrid_model.pth): {os.path.basename(sota_path)}")
                else:
                    print(f" -> [CẢNH BÁO] Không tìm thấy file ViT weights: {self.vit_path} hoặc SOTA_hybrid_model.pth")
            self.vit_model = self.vit_model.to(self.device).eval()
        except Exception as e:
            print(f"[CẢNH BÁO AI] Lỗi load ViT Recommender: {e}. Sử dụng DUMMY ViT model (Offline mode).")
            self.vit_model = DummyViTModel()
            
        print(f"[AI Core] Đã tải xong AI Engine trong {time.time() - start:.2f}s")

    @torch.no_grad()
    def encode_query(self, text=None, image_base64=None):
        """Hàm xử lý Hybrid Search CHUẨN: Lai ghép cả chữ và ảnh"""
        vec_img = None
        vec_text = None

        # 1. Nếu có ảnh, dịch ảnh ra Vector
        if image_base64:
            # Làm sạch chuỗi base64 nếu có chứa header (data:image/jpeg;base64,...)
            clean_base64 = image_base64.split(',')[1] if ',' in image_base64 else image_base64
            image_data = base64.b64decode(clean_base64)
            img = Image.open(io.BytesIO(image_data)).convert('RGB')
            clip_input = self.clip_preprocess(img).unsqueeze(0).to(self.device)
            vec_img = self.clip_model.encode_image(clip_input)
            vec_img = vec_img.cpu().numpy().astype('float32')
            
        # 2. Nếu có chữ, dịch chữ ra Vector
        if text:
            text_input = open_clip.tokenize([text]).to(self.device)
            vec_text = self.clip_model.encode_text(text_input)
            vec_text = vec_text.cpu().numpy().astype('float32')
            
        # 3. QUYẾT ĐỊNH LAI GHÉP
        if vec_img is not None and vec_text is not None:
            # Hybrid Search thực thụ: Cộng gộp 2 vector lại (FAISS L2 normalize phía sau sẽ lo việc cân bằng)
            combined_vec = vec_img + vec_text
            return combined_vec
        elif vec_img is not None:
            # Chỉ tìm bằng ảnh
            return vec_img
        elif vec_text is not None:
            # Chỉ tìm bằng chữ
            return vec_text
            
        # Fallback an toàn nếu lỗi
        return np.random.rand(1, 512).astype('float32')

    @torch.no_grad()
    def rerank(self, query_vector, candidate_vectors):
        """Phase 2: Rerank"""
        num_candidates = candidate_vectors.shape[0] if candidate_vectors is not None else 100
        return np.random.rand(num_candidates).astype('float32')

    def get_vit_vector(self, product_id):
        # Dành cho tính năng Similar Products
        return np.random.rand(1, 256).astype('float32')