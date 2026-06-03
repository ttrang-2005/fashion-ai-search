import { configureStore } from '@reduxjs/toolkit';
import searchReducer from '../features/search/searchSlice';
import productReducer from '../features/product/productSlice'; // Thêm dòng này

export const store = configureStore({
    reducer: {
        search: searchReducer,
        product: productReducer, // Đăng ký reducer
    },
    devTools: import.meta.env.NODE_ENV !== 'production',
});