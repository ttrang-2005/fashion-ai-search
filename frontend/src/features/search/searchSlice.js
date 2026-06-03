import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import apiClient from '../../services/api';

export const fetchSearchResults = createAsyncThunk(
    'search/fetchHybrid',
    async (searchPayload, { rejectWithValue }) => {
        try {
            // Xác định xem payload gửi vào là chuỗi chữ hay là Object (từ Home.jsx)
            const requestData = typeof searchPayload === 'string' 
                ? { query: searchPayload, image: null, limit: 20 }
                : { 
                    query: searchPayload?.query || null, 
                    image: searchPayload?.image || null, 
                    limit: 20 
                  };

            // Gọi đồng nhất 1 phương thức POST cho mọi trường hợp
            const response = await apiClient.post('/search/hybrid', requestData);

            return response.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Lỗi kết nối máy chủ tìm kiếm');
        }
    }
);

const searchSlice = createSlice({
    name: 'search',
    initialState: {
        results: [],
        isLoading: false,
        error: null,
        lastQuery: null
    },
    reducers: {
        clearResults: (state) => {
            state.results = [];
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchSearchResults.pending, (state, action) => {
                state.isLoading = true;
                state.error = null;
                // Lưu lại lịch sử tìm kiếm để phục vụ giao diện nếu cần
                state.lastQuery = action.meta.arg;
            })
            .addCase(fetchSearchResults.fulfilled, (state, action) => {
                state.isLoading = false;
                // Đảm bảo kết quả luôn là một mảng an toàn
                state.results = Array.isArray(action.payload) ? action.payload : [];
            })
            .addCase(fetchSearchResults.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload;
            });
    }
});

export const { clearResults } = searchSlice.actions;
export default searchSlice.reducer;