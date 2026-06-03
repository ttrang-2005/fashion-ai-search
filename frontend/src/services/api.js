import axios from 'axios';

const apiClient = axios.create({
    // TRỎ THẲNG VÀO NODE.JS (Thay vì '/api/v1' chung chung)
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1', 
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    timeout: 30000});

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('[API Error]', error.response?.data?.message || error.message);
        return Promise.reject(error);
    }
);

export default apiClient;