import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../services/api';

export const fetchProductDetail = createAsyncThunk(
    'product/fetchDetail',
    async (id, { rejectWithValue }) => {
        try {
            const response = await apiClient.get(`/products/${id}`);
            return response.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Không tìm thấy sản phẩm');
        }
    }
);

export const fetchSimilarProducts = createAsyncThunk(
    'product/fetchSimilar',
    async (id, { rejectWithValue }) => {
        try {
            const response = await apiClient.get(`/products/${id}/similar?limit=20`);
            return response.data.data;
        } catch (error) {
            return rejectWithValue('Lỗi tải sản phẩm tương tự');
        }
    }
);

const productSlice = createSlice({
    name: 'product',
    initialState: {
        detail: null,
        similar: [],
        isDetailLoading: false,
        isSimilarLoading: false,
        error: null
    },
    reducers: {
        clearProductState: (state) => {
            state.detail = null;
            state.similar = [];
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        // Xử lý Detail
        builder.addCase(fetchProductDetail.pending, (state) => {
            state.isDetailLoading = true;
            state.error = null;
        });
        builder.addCase(fetchProductDetail.fulfilled, (state, action) => {
            state.isDetailLoading = false;
            state.detail = action.payload;
        });
        builder.addCase(fetchProductDetail.rejected, (state, action) => {
            state.isDetailLoading = false;
            state.error = action.payload;
        });

        // Xử lý Similar Products
        builder.addCase(fetchSimilarProducts.pending, (state) => {
            state.isSimilarLoading = true;
        });
        builder.addCase(fetchSimilarProducts.fulfilled, (state, action) => {
            state.isSimilarLoading = false;
            state.similar = Array.isArray(action.payload) ? action.payload : [];
        });
        builder.addCase(fetchSimilarProducts.rejected, (state) => {
            state.isSimilarLoading = false;
            state.similar = []; // Fallback an toàn, không block UI
        });
    }
});

export const { clearProductState } = productSlice.actions;
export default productSlice.reducer;
