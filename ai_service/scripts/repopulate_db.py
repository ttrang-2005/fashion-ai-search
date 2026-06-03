import os
import pandas as pd
from pathlib import Path
from pymongo import MongoClient

# ==========================================
# 1. PATH CONFIGURATION
# ==========================================
BASE_IMAGE_PATH = Path("D:/fashion-ai-search")
DIR_CLOTHES = BASE_IMAGE_PATH / "clothesimages"
DIR_WOMEN = BASE_IMAGE_PATH / "women"

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CSV_PATH = DATA_DIR / "data_new.csv"
FASHION200K_LABELS_DIR = DIR_WOMEN / "fashion-200k" / "labels"

CHECKPOINT_FILE = DATA_DIR / "processed_images.txt"
PRODUCT_IDS_FILE = DATA_DIR / "product_ids.txt"

MONGO_URI = "mongodb://localhost:27017/fashion_db"
DB_NAME = "fashion_db"

def normalize_img_key(filepath_str):
    name = Path(str(filepath_str)).name.lower().strip()
    stem = Path(name).stem
    if stem.isdigit():
        return str(int(stem))
    return stem

def load_metadata():
    metadata_clothes = {}
    metadata_women = {}
    
    # 1. Load CSV
    if CSV_PATH.exists():
        print(f"[System] Loading CSV from: {CSV_PATH}")
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
                
            # Extract color from link/name
            comb = (str(row.get('link', '')) + " " + str(row.get('name', ''))).lower()
            extracted_color = "Black"  # Fallback
            for c in colors_list:
                p = c
                if c == 'gray':
                    p = 'grey'
                if p in comb:
                    extracted_color = p.title()
                    break
            
            metadata_clothes[filename_key] = (name, extracted_color)
        print(f"[System] Loaded {len(metadata_clothes)} CSV items.")
    else:
        print(f"[Error] CSV not found at {CSV_PATH}")
        
    # 2. Load TXT Labels
    if FASHION200K_LABELS_DIR.exists():
        print(f"[System] Loading labels from: {FASHION200K_LABELS_DIR}")
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
        print(f"[System] Loaded {len(metadata_women)} labels from TXT.")
    else:
        print(f"[Error] TXT Labels directory not found at {FASHION200K_LABELS_DIR}")
        
    return metadata_clothes, metadata_women

def main():
    print("[System] Reading database metadata...")
    metadata_clothes, metadata_women = load_metadata()
    
    # 3. Read processed_images.txt and product_ids.txt
    if not CHECKPOINT_FILE.exists():
        print(f"[Error] checkpoint file not found at {CHECKPOINT_FILE}")
        return
    if not PRODUCT_IDS_FILE.exists():
        print(f"[Error] product_ids.txt not found at {PRODUCT_IDS_FILE}")
        return
        
    with open(CHECKPOINT_FILE, "r", encoding="utf-8") as f:
        img_paths = [line.strip() for line in f if line.strip()]
        
    with open(PRODUCT_IDS_FILE, "r", encoding="utf-8") as f:
        prod_ids = [line.strip() for line in f if line.strip()]
        
    if len(img_paths) != len(prod_ids):
        print(f"[Warning] size mismatch! Images: {len(img_paths)}, IDs: {len(prod_ids)}")
        
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    print("[System] Dropping and recreating 'products' collection...")
    db.products.drop()
    db.products.create_index("product_id", unique=True)
    
    mongo_docs = []
    
    print("[System] Building product records for MongoDB...")
    for idx, (img_path_str, prod_id) in enumerate(zip(img_paths, prod_ids)):
        img_path = Path(img_path_str)
        is_clothes = "clothesimages" in img_path_str.lower()
        
        filename_key = normalize_img_key(img_path.name)
        
        if is_clothes:
            if filename_key in metadata_clothes:
                name, color = metadata_clothes[filename_key]
            else:
                name = f"Clothes Item {filename_key}"
                color = "Black"
            cat_name = "Clothes"
            sub_name = "General"
            gender = "male"
            web_url = f"/images/clothes/{img_path.name}"
        else:
            if filename_key in metadata_women:
                name, color = metadata_women[filename_key]
            else:
                name = f"Women Item {filename_key}"
                color = "Black"
            
            # Correct category and subcategory shifting
            cat_name = img_path.parent.parent.parent.name.replace("_", " ").title()
            sub_name = img_path.parent.parent.name.replace("_", " ").title()
            gender = "female"
            
            # Relative path format for web URL
            try:
                rel_path = img_path.relative_to(DIR_WOMEN).as_posix()
            except ValueError:
                # If we cannot resolve relative to DIR_WOMEN (e.g. windows vs docker path formats)
                lower_str = img_path_str.replace("\\", "/").lower()
                if "women/" in lower_str:
                    rel_path = img_path_str[lower_str.find("women/") + 6:].replace("\\", "/")
                else:
                    rel_path = img_path.name
            web_url = f"/images/women/{rel_path}"
            
        mongo_docs.append({
            "product_id": prod_id,
            "name": name,
            "category": cat_name,
            "sub_category": sub_name,
            "gender": gender,
            "color": color,
            "image_urls": [web_url],
            "is_active": True
        })
        
    if mongo_docs:
        print(f"[System] Inserting {len(mongo_docs)} products into MongoDB...")
        batch_size = 1000
        for b in range(0, len(mongo_docs), batch_size):
            db.products.insert_many(mongo_docs[b:b+batch_size], ordered=False)
        print(f"[Success] Successfully repopulated {len(mongo_docs)} products in MongoDB!")
    else:
        print("[Warning] No documents generated.")

if __name__ == "__main__":
    main()
