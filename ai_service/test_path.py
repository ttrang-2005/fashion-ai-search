from pathlib import Path

# Thử đường dẫn 1
BASE_1 = Path("D:/fashion-ai-search")
# Thử đường dẫn 2 (Dựa vào log terminal của bạn)
BASE_2 = Path("D:/fashion-ai-search/fashion-ai-search")

def check_paths(base_path):
    print(f"\n🔍 ĐANG KIỂM TRA ĐƯỜNG DẪN: {base_path}")
    dir_clothes = base_path / "clothesimages"
    dir_women = base_path / "women"
    
    print(f"  [1] Thư mục '{dir_clothes}': {'✅ TỒN TẠI' if dir_clothes.exists() else '❌ KHÔNG TÌM THẤY'}")
    if dir_clothes.exists():
        clothes_count = len(list(dir_clothes.glob("*.[jJ][pP][gG]")))
        print(f"      -> Tìm thấy {clothes_count} ảnh JPG.")

    print(f"  [2] Thư mục '{dir_women}': {'✅ TỒN TẠI' if dir_women.exists() else '❌ KHÔNG TÌM THẤY'}")
    if dir_women.exists():
        women_count = 0
        # Dùng rglob để đếm toàn bộ ảnh trong các thư mục con sâu nhất
        women_count = len(list(dir_women.rglob("*.[jJ][pP][gG]")))
        print(f"      -> Tìm thấy tổng cộng {women_count} ảnh JPG.")

check_paths(BASE_1)
check_paths(BASE_2)