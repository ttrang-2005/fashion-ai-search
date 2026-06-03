import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../services/api';

export const fetchSearchResults = createAsyncThunk(
    'search/fetchResults',
    async ({ query, image }, { rejectWithValue }) => {
        try {
            // GỬI CHÍNH XÁC OBJECT { query, image } SANG BACKEND
            const response = await api.post('/search/hybrid', {
                query: query,
                image: image  // Dòng này rất quan trọng, không được thiếu!
            });
            
            return response.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Có lỗi xảy ra');
        }
    }
);

const searchSlice = createSlice({
    name: 'search',
    initialState: {
        results: [], // Đảm bảo luôn là array
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
                state.lastQuery = action.meta.arg;
            })
            .addCase(fetchSearchResults.fulfilled, (state, action) => {
                state.isLoading = false;
                // action.payload lúc này là một mảng an toàn
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