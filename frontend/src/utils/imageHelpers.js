/**
 * Chuyển đổi File Object thành chuỗi Base64
 * @param {File} file - File ảnh từ input
 * @returns {Promise} - Chuỗi Base64 (đã loại bỏ prefix)
 */
export const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.readAsDataURL(file);
        
        reader.onload = () => {
            // reader.result có dạng: "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
            // Ta chỉ lấy phần chuỗi mã hóa phía sau dấu phẩy để gửi lên AI Service
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        
        reader.onerror = (error) => {
            reject(error);
        };
    });
};