import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../src/services/api';

export const fetchSearchResults = createAsyncThunk(
    'search/fetchHybrid',
    async (query, { rejectWithValue }) => {
        try {
            const isText = typeof query === 'string';
            const response = isText 
                ? await apiClient.get(`/search/hybrid?q=${encodeURIComponent(query)}`)
                : await apiClient.post('/search/hybrid', query);
            
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
                state.lastQuery = action.meta.arg;
            })
            .addCase(fetchSearchResults.fulfilled, (state, action) => {
                state.isLoading = false;
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