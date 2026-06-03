import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './MasonryGrid.module.scss';

const MasonryGrid = ({ products, searchContext }) => {
    const navigate = useNavigate();

    if (!Array.isArray(products) || products.length === 0) {
        return null;
    }

    const handleProductClick = (product) => {
        navigate(`/product/${product.product_id}`);
    };

    // Helper to format image URLs properly
    const getImageUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        const baseUrl = import.meta.env.VITE_IMAGE_BASE_URL;
        const base = (baseUrl !== undefined && baseUrl !== null) ? baseUrl : 'http://localhost:3000';
        return `${base}${url}`;
    };

    return (
        <div className={styles.gridContainer}>
            {products.map((product, index) => (
                <article
                    key={product.product_id || `${index}-${product.name}`}
                    className={styles.card}
                    onClick={() => handleProductClick(product)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleProductClick(product);
                        }
                    }}
                    aria-label={`Xem chi tiết ${product.name || 'sản phẩm'}`}
                    data-query={searchContext?.query || ''}
                >
                    {/* Image Wrapper */}
                    <div className={styles.imageWrapper}>
                        {product.image_urls?.[0] ? (
                            <img
                                src={getImageUrl(product.image_urls[0])}
                                alt={product.name || 'Product image'}
                                className={styles.image}
                                loading="lazy"
                            />
                        ) : (
                            <div className={styles.imagePlaceholder}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                    <circle cx="9" cy="9" r="2"/>
                                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                                </svg>
                                <span>No Image Available</span>
                            </div>
                        )}
                        
                        {/* Elegant overlay on hover */}
                        <div className={styles.overlay}>
                            <span className={styles.viewDetail}>VIEW DETAILS</span>
                        </div>

                        {/* Top float matching badge */}
                        {typeof product.ai_score === 'number' && (
                            <div className={styles.aiBadge}>
                                <span className={styles.pulseDot}></span>
                                <span className={styles.aiText}>{(product.ai_score * 100).toFixed(0)}% MATCH</span>
                            </div>
                        )}
                    </div>

                    {/* Product Information */}
                    <div className={styles.info}>
                        <div className={styles.brand}>{product.category || 'DESIGNER'}</div>
                        
                        <div className={styles.name}>
                            {product.name ? product.name.replace(/\.[^/.]+$/, "") : 'Sản phẩm thời trang'}
                        </div>
                        
                        <div className={styles.description}>
                            {product.description || `Mẫu ${product.sub_category?.toLowerCase() || 'thiết kế'} hiện đại, phù hợp cho nhiều phong cách phối đồ hàng ngày.`}
                        </div>
                    </div>
                </article>
            ))}
        </div>
    );
};

export default React.memo(MasonryGrid);