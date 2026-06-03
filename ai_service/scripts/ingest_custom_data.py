import os
import pandas as pd
from pathlib import Path
import numpy as np
import faiss
import uuid
import re
from pymongo import MongoClient
from PIL import Image
import gc
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.models as models
from torchvision import transforms
from transformers import AutoModel
import open_clip
from torch.utils.data import Dataset, DataLoader

# ==========================================
# 1. PATH CONFIGURATION & OPTIMIZATION
# ==========================================
BASE_IMAGE_PATH = Path("D:/fashion-ai-search") 
DIR_CLOTHES = BASE_IMAGE_PATH / "clothesimages"
DIR_WOMEN = BASE_IMAGE_PATH / "women"

MODEL_DIR = Path(__file__).resolve().parent.parent / "models"
CLIP_MODEL_PATH = MODEL_DIR / "model_555.pt"
SOTA_MODEL_PATH = MODEL_DIR / "SOTA_hybrid_model.pth" # Đã đổi sang mô hình mới

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)

CSV_PATH = DATA_DIR / "data_new.csv" 
FASHION200K_LABELS_DIR = DIR_WOMEN / "fashion-200k" / "labels"

MONGO_URI = "mongodb://localhost:27017/fashion_db"
DB_NAME = "fashion_db"

device = "cuda" if torch.cuda.is_available() else "cpu"

BATCH_SIZE = 16 
NUM_WORKERS = 0
SAVE_EVERY_N_BATCHES = 50 
CHECKPOINT_FILE = DATA_DIR / "processed_images.txt"

# ==========================================
# CLIP ZERO-SHOT COLOR CLASSES
# ==========================================
COLORS = [
    'Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Pink', 'Purple',
    'Grey', 'Brown', 'Orange', 'Beige', 'Navy', 'Maroon', 'Olive'
]
# Tạo các câu prompt (mồi) để CLIP hiểu ngữ cảnh đang tìm màu của quần áo
COLOR_PROMPTS = [f"a photo of a {c.lower()} clothing item" for c in COLORS]
def normalize_img_key(filepath_str):
    name = Path(str(filepath_str)).name.lower().strip()
    stem = Path(name).stem # CHỈ LẤY PHẦN LÕI, BỎ LUÔN ĐUÔI FILE (Ví dụ: "10016.jpg" -> "10016")
    
    # Nếu phần lõi là số, ép về int để xóa số 0 ở đầu (vd "0100" -> "100")
    if stem.isdigit():
        return str(int(stem))
        
    return stem
# ==========================================
# 2. METADATA LOADING FUNCTION (ĐÃ TÁCH 2 NGUỒN)
# ==========================================
def load_metadata():
    metadata_clothes = {}
    metadata_women = {}
    
    # Nguồn 1: Đọc từ CSV
    if CSV_PATH.exists():
        print(f"[System] Đang đọc file CSV tại: {CSV_PATH}")
        df = pd.read_csv(CSV_PATH)
        
        colors_list = [
            'black', 'white', 'blue', 'red', 'green', 'yellow', 'pink', 'purple',
            'grey', 'gray', 'brown', 'orange', 'beige', 'navy', 'maroon', 'olive',
            'indigo', 'khaki', 'cream', 'charcoal', 'mustard', 'peach', 'rust', 'tan',
            'teal', 'turquoise', 'burgundy', 'camel'
        ]
        
        for _, row in df.iterrows():
            filename_key = normalize_img_key(row['local_image_path'])
            
            if 'clean_name' in row and pd.notna(row['clean_name']):
                name = str(row['clean_name']).title()
            else:
                name = str(row['name'])
                
            # Trích xuất màu sắc từ link/name
            comb = (str(row.get('link', '')) + " " + str(row.get('name', ''))).lower()
            extracted_color = None
            for c in colors_list:
                p = c
                if c == 'gray':
                    p = 'grey'
                if p in comb:
                    extracted_color = p.title()
                    break
            
            metadata_clothes[filename_key] = (name, extracted_color)
                
        print(f"[System] ✔️ Đã nạp thành công {len(metadata_clothes)} tên quần áo (Clothes) từ CSV!")
    else:
        print(f"❌ [LỖI]: Không tìm thấy file CSV tại: {CSV_PATH}")
            
    # Nguồn 2: Đọc từ TXT
    if FASHION200K_LABELS_DIR.exists():
        for file_name in os.listdir(FASHION200K_LABELS_DIR):
            if file_name.endswith('.txt'):
                with open(FASHION200K_LABELS_DIR / file_name, 'r', encoding='utf-8') as f:
                    for line in f:
                        parts = line.strip().split()
                        if len(parts) >= 3:
                            filename_key = normalize_img_key(parts[0])
                            color = parts[2].title()
                            name = " ".join(parts[3:]).title() if len(parts) > 3 else f"{color} Item"
                            metadata_women[filename_key] = (name, color)
        print(f"[System] ✔️ Đã nạp thành công {len(metadata_women)} tên thời trang nữ (Women) từ TXT!")
    else:
        print(f"❌ [LỖI]: Không tìm thấy thư mục TXT tại: {FASHION200K_LABELS_DIR}")
                            
    return metadata_clothes, metadata_women

# ==========================================
# 3. KIẾN TRÚC SOTA MỚI (TÍCH HỢP MQM VÀ COMBINER)
# ==========================================
class RegionAwareMQM(nn.Module):
    def __init__(self, embed_dim, num_queries=32):
        super().__init__()
        self.item_meta_matrix = nn.Parameter(torch.randn(num_queries, embed_dim))
        nn.init.normal_(self.item_meta_matrix, std=0.02)
        self.query_proj = nn.Linear(embed_dim, embed_dim)
        self.value_proj = nn.Linear(embed_dim, embed_dim)

    def forward(self, patch_features):
        queries, values = self.query_proj(self.item_meta_matrix), self.value_proj(self.item_meta_matrix)
        scores = torch.matmul(patch_features, queries.T) / (patch_features.size(-1) ** 0.5)
        attn_weights = F.softmax(scores, dim=-1)
        region_aware_vector = torch.matmul(attn_weights.transpose(1, 2), patch_features).mean(dim=1)
        return region_aware_vector

class GatedCombiner(nn.Module):
    def __init__(self, embed_dim):
        super().__init__()
        self.gate = nn.Sequential(
            nn.Linear(embed_dim * 2, embed_dim),
            nn.Sigmoid()
        )

    def forward(self, img_embed, txt_embed):
        combined_features = torch.cat([img_embed, txt_embed], dim=-1)
        gate_value = self.gate(combined_features)
        composed_vector = gate_value * img_embed + (1 - gate_value) * txt_embed
        return F.normalize(composed_vector, p=2, dim=-1)

class SotaHybridRecommender(nn.Module):
    def __init__(self, embed_dim=256, num_heads=4, dropout_rate=0.14598): # Dùng thông số dropout best params
        super().__init__()
        self.num_heads = num_heads
        self.head_dim = embed_dim // num_heads

        self.vit = models.vit_b_16(weights=models.ViT_B_16_Weights.DEFAULT)
        self.vit.heads = nn.Identity() 
        self.img_proj = nn.Linear(768, embed_dim)

        self.bert = AutoModel.from_pretrained('distilbert-base-uncased')
        self.text_proj = nn.Linear(self.bert.config.hidden_size, embed_dim)

        self.region_mqm = RegionAwareMQM(embed_dim)
        self.text_mqm = RegionAwareMQM(embed_dim) 
        self.combiner = GatedCombiner(embed_dim)

        self.logit_scale = nn.Parameter(torch.ones([]) * np.log(1 / 0.07))
        self.fit_ranker = nn.Sequential(
            nn.Linear((self.head_dim * 4) * self.num_heads, 512),
            nn.LayerNorm(512), nn.GELU(), nn.Dropout(dropout_rate),
            nn.Linear(512, 128), nn.LayerNorm(128), nn.GELU(), nn.Dropout(dropout_rate / 2),
            nn.Linear(128, 1)
        )

    def encode_image(self, images):
        x = self.vit._process_input(images)
        n = x.shape[0]
        batch_class_token = self.vit.class_token.expand(n, -1, -1)
        x = torch.cat([batch_class_token, x], dim=1)
        x = self.vit.encoder(x) 
        patch_feats = self.img_proj(x)
        return F.normalize(self.region_mqm(patch_feats), p=2, dim=-1)

    def encode_text(self, input_ids, attention_mask):
        txt_out = self.bert(input_ids, attention_mask).last_hidden_state
        txt_feats = self.text_proj(txt_out)
        return F.normalize(self.text_mqm(txt_feats), p=2, dim=-1)

    def forward(self, images, pos_ids, pos_mask):
        img_embeds = self.encode_image(images)
        txt_embeds = self.encode_text(pos_ids, pos_mask)
        return img_embeds, txt_embeds

    def rank_fit(self, img_vecs, txt_vecs):
        batch = img_vecs.size(0)
        img_h, txt_h = img_vecs.view(batch, self.num_heads, self.head_dim), txt_vecs.view(batch, self.num_heads, self.head_dim)
        interaction = torch.cat([img_h, txt_h, img_h * txt_h, torch.abs(img_h - txt_h)], dim=-1).view(batch, -1)
        return self.fit_ranker(interaction).squeeze(-1)

# ==========================================
# 4. DATALOADER PREPARATION
# ==========================================
class FashionDataset(Dataset):
    def __init__(self, clip_prep, vit_prep, metadata_clothes, metadata_women):
        self.processed_set = set()
        if CHECKPOINT_FILE.exists():
            with open(CHECKPOINT_FILE, "r", encoding="utf-8") as f:
                self.processed_set = set(line.strip() for line in f)
        
        self.clip_prep = clip_prep
        self.vit_prep = vit_prep
        self.metadata_clothes = metadata_clothes # Dành riêng cho clothesimages
        self.metadata_women = metadata_women     # Dành riêng cho women
        self.image_list = self._scan_directories()

    def _scan_directories(self):
        items = []
        valid_exts = {'.jpg', '.jpeg', '.png', '.webp'}
        
        def scan_dir(directory, is_clothes):
            if not directory.exists(): return
            for img in directory.rglob("*"): 
                if img.is_file() and img.suffix.lower() in valid_exts:
                    if str(img) not in self.processed_set: 
                        
                        filename_key = normalize_img_key(img.name)
                        
                        # [SỬA Ở ĐÂY]: KIỂM TRA ĐIỀU KIỆN NGHIÊM NGẶT
                        if is_clothes:
                            # Nếu file không có trong CSV -> BỎ QUA KHÔNG ĐỌC ẢNH NÀY NỮA
                            if filename_key not in self.metadata_clothes:
                                continue 
                            real_name, color_label = self.metadata_clothes[filename_key]
                        else:
                            # Nếu file không có trong TXT -> BỎ QUA
                            if filename_key not in self.metadata_women:
                                continue
                            real_name, color_label = self.metadata_women[filename_key]
                            
                        cat_name = "Clothes" if is_clothes else img.parent.parent.parent.name.replace("_", " ").title()
                        sub_name = "General" if is_clothes else img.parent.parent.name.replace("_", " ").title()
                        
                        items.append({
                            "path": img, "cat": cat_name, "sub": sub_name, 
                            "type": "clothes" if is_clothes else "women", "real_name": real_name, "color": color_label
                        })
        # Quét 2 thư mục riêng biệt
        scan_dir(DIR_CLOTHES, True)
        scan_dir(DIR_WOMEN, False)
        return items

    def __len__(self): return len(self.image_list)


    def __getitem__(self, idx):
        item = self.image_list[idx]
        try:
            img = Image.open(item["path"]).convert('RGB')
            clip_tensor = self.clip_prep(img)
            vit_tensor = self.vit_prep(img)
            web_url = f"/images/clothes/{item['path'].name}" if item["type"] == "clothes" else f"/images/women/{item['path'].relative_to(DIR_WOMEN).as_posix()}"

            return {
                "clip_tensor": clip_tensor, "vit_tensor": vit_tensor,
                "cat": item["cat"], "sub": item["sub"], 
                "name": item["real_name"], "color": item["color"], "url": web_url, "raw_path": str(item["path"]) 
            }
        except Exception:
            return None

def collate_fn_safe(batch):
    batch = [b for b in batch if b is not None]
    if not batch: return None
    clip_tensors = torch.stack([b['clip_tensor'] for b in batch])
    vit_tensors = torch.stack([b['vit_tensor'] for b in batch])
    meta = [{"cat": b['cat'], "sub": b['sub'], "name": b['name'], "color": b['color'], "url": b['url'], "raw_path": b['raw_path']} for b in batch]
    return clip_tensors, vit_tensors, meta

# ==========================================
# 5. MAIN PIPELINE
# ==========================================
def main():
    print(f"[System] Initializing on {device.upper()}")
    metadata_clothes, metadata_women = load_metadata()
    print(f"[System] Successfully mapped names: {len(metadata_clothes)} (Clothes) & {len(metadata_women)} (Women)!")

    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    if not CHECKPOINT_FILE.exists():
        db.products.drop()
        db.products.create_index("product_id", unique=True)

    clip_index_path = DATA_DIR / "openclip.index"
    vit_index_path = DATA_DIR / "vit.index"
    product_ids_path = DATA_DIR / "product_ids.npy"
    
    if clip_index_path.exists() and vit_index_path.exists() and CHECKPOINT_FILE.exists():
        clip_index = faiss.read_index(str(clip_index_path))
        vit_index = faiss.read_index(str(vit_index_path))
        product_ids = np.load(str(product_ids_path), allow_pickle=True).tolist()
    else:
        clip_index = faiss.IndexFlatIP(512)
        vit_index = faiss.IndexFlatIP(256)
        product_ids = []

    print("[System] Loading CLIP and SOTA ViT models...")
    clip_model, _, clip_preprocess = open_clip.create_model_and_transforms('ViT-B-32', pretrained='laion2b_s34b_b79k')
    
    # Nạp trọng số cho mô hình CLIP nếu có
    if CLIP_MODEL_PATH.exists():
        clip_model.load_state_dict(torch.load(CLIP_MODEL_PATH, map_location=device))
    clip_model = clip_model.to(device).eval()
    tokenizer = open_clip.get_tokenizer('ViT-B-32')

    # TIỀN XỬ LÝ VECTOR VĂN BẢN (MÀU SẮC) 
    print("[System] Initializing AI Color Recognition capabilities...")
    text_tokens = tokenizer(COLOR_PROMPTS).to(device)
    with torch.no_grad():
        text_features = clip_model.encode_text(text_tokens)
        text_features /= text_features.norm(dim=-1, keepdim=True) # Chuẩn hóa Vector

    # NẠP KIẾN TRÚC MỚI VÀ LOAD TRỌNG SỐ TỐT NHẤT VỪA TRAIN XONG
    vit_model = SotaHybridRecommender(embed_dim=256, num_heads=4).to(device)
    if SOTA_MODEL_PATH.exists():
        print(f"[System] Loading fine-tuned SOTA weights from {SOTA_MODEL_PATH}...")
        vit_model.load_state_dict(torch.load(SOTA_MODEL_PATH, map_location=device))
    else:
        print(f"[Warning] Không tìm thấy file {SOTA_MODEL_PATH}. Mô hình sẽ chạy với trọng số mặc định.")
    vit_model.eval()

    vit_transform = transforms.Compose([transforms.Resize((224, 224)), transforms.ToTensor(), transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])])

    dataset = FashionDataset(clip_preprocess, vit_transform, metadata_clothes, metadata_women)
    dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=NUM_WORKERS, collate_fn=collate_fn_safe)
    mongo_docs = []
    processed_paths = []

    with torch.no_grad():
        for batch_idx, data in enumerate(dataloader):
            if data is None: continue
            
            clip_tensors, vit_tensors, meta_list = data
            clip_tensors, vit_tensors = clip_tensors.to(device), vit_tensors.to(device)
            
            # --- 1. Tính toán Vector cho FAISS Search (Dùng SOTA Model) ---
            image_features = clip_model.encode_image(clip_tensors)
            vit_features = vit_model.encode_image(vit_tensors)
            
            # --- 2. AI ĐOÁN MÀU SẮC BẰNG ZERO-SHOT ---
            image_features_norm = image_features / image_features.norm(dim=-1, keepdim=True)
            similarity = (100.0 * image_features_norm @ text_features.T).softmax(dim=-1)
            best_color_indices = similarity.argmax(dim=-1) 

            clip_vecs = image_features.to(torch.float32).cpu().numpy()
            vit_vecs = vit_features.to(torch.float32).cpu().numpy()
            faiss.normalize_L2(clip_vecs)
            faiss.normalize_L2(vit_vecs)
            
            clip_index.add(clip_vecs)
            vit_index.add(vit_vecs)

            for i, meta in enumerate(meta_list):
                prod_id = f"prod_{uuid.uuid4().hex[:10]}"
                product_ids.append(prod_id)
                processed_paths.append(meta['raw_path'])
                
                gender_label = "male" if "clothesimages" in meta['raw_path'].lower() else "female"
                predicted_color = COLORS[best_color_indices[i].item()]
                final_color = meta['color'] if meta['color'] else predicted_color
                
                mongo_docs.append({
                    "product_id": prod_id, 
                    "name": meta['name'], 
                    "category": meta['cat'], 
                    "sub_category": meta['sub'],
                    "gender": gender_label,
                    "color": final_color,
                    "image_urls": [meta['url']], 
                    "is_active": True
                })
            
            if (batch_idx + 1) % SAVE_EVERY_N_BATCHES == 0 or (batch_idx + 1) == len(dataloader):
                faiss.write_index(clip_index, str(clip_index_path))
                faiss.write_index(vit_index, str(vit_index_path))
                np.save(str(product_ids_path), np.array(product_ids))
                
                # Ghi đè file product_ids.txt để đồng bộ với product_ids.npy
                with open(DATA_DIR / "product_ids.txt", "w", encoding="utf-8") as pf:
                    pf.write("\n".join(product_ids) + "\n")
                    
                if mongo_docs:
                    db.products.insert_many(mongo_docs, ordered=False)
                    mongo_docs = []
                with open(CHECKPOINT_FILE, "a", encoding="utf-8") as f:
                    for p in processed_paths: f.write(p + "\n")
                processed_paths = []
                print(f"[Auto-Save] Checkpoint saved at batch {batch_idx + 1}.")
                
            if device == "cuda": torch.cuda.empty_cache()
            gc.collect()

if __name__ == "__main__":
    main()