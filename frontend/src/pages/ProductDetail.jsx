import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, Link } from 'react-router-dom';
import MasonryGrid from '../components/MasonryGrid/MasonryGrid';
import { clearProductState, fetchProductDetail, fetchSimilarProducts } from '../features/product/productSlice';
import styles from './ProductDetail.module.scss';

const ProductDetail = () => {
    const { id } = useParams();
    const dispatch = useDispatch();

    const {
        detail,
        similar,
        isDetailLoading,
        isSimilarLoading,
        error
    } = useSelector((state) => state.product);

    useEffect(() => {
        window.scrollTo(0, 0);
        dispatch(clearProductState());

        if (id) {
            dispatch(fetchProductDetail(id));
            dispatch(fetchSimilarProducts(id));
        }
    }, [id, dispatch]);

    const getImageUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        const baseUrl = import.meta.env.VITE_IMAGE_BASE_URL;
        const base = (baseUrl !== undefined && baseUrl !== null) ? baseUrl : 'http://localhost:3000';
        return `${base}${url}`;
    };

    if (isDetailLoading) {
        return (
            <div className={styles.page}>
                <div className={styles.stateContainer}>
                    <div className={styles.loaderCircle}></div>
                    <p className={styles.state}>Loading product details...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.page}>
                <div className={styles.stateContainer}>
                    <div className={styles.errorIcon}>⚠️</div>
                    <p className={styles.state}>Error: {error}</p>
                    <Link to="/" className={styles.backButton}>Return to Studio Gallery</Link>
                </div>
            </div>
        );
    }

    if (!detail) {
        return (
            <div className={styles.page}>
                <div className={styles.stateContainer}>
                    <p className={styles.state}>Product not found.</p>
                    <Link to="/" className={styles.backButton}>Return to Studio Gallery</Link>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            {/* Sticky Navigation Header */}
            <nav className={styles.navbar}>
                <div className={styles.navContainer}>
                    <Link to="/" className={styles.logo}>
                        FASHION <span className={styles.goldText}>AI</span>
                    </Link>
                    <div className={styles.navStatus}>
                        <span className={styles.pulseIndicator}></span>
                        <span>PRODUCT INSPECTION</span>
                    </div>
                </div>
            </nav>

            <main className={styles.mainContainer}>
                {/* Back Link */}
                <div className={styles.backLinkWrapper}>
                    <Link to="/" className={styles.backButton}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12"></line>
                            <polyline points="12 19 5 12 12 5"></polyline>
                        </svg>
                        <span>BACK TO GALLERY</span>
                    </Link>
                </div>

                {/* Main Product Card */}
                <section className={styles.detailCard}>
                    <div className={styles.imageWrap}>
                        {detail.image_urls?.[0] ? (
                            <div className={styles.imageFrame}>
                                <img
                                    src={getImageUrl(detail.image_urls[0])}
                                    alt={detail.name || 'Product image'}
                                    className={styles.image}
                                />
                            </div>
                        ) : (
                            <div className={styles.imagePlaceholder}>
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                    <circle cx="9" cy="9" r="2"/>
                                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                                </svg>
                                <span>No product image</span>
                            </div>
                        )}
                    </div>

                    <div className={styles.content}>
                        <p className={styles.brand}>{detail.brand || 'DESIGNER COLLECTION'}</p>
                        <h1 className={styles.name}>
                            {detail.name ? detail.name.replace(/\.[^/.]+$/, "") : 'Sản phẩm thời trang'}
                        </h1>
                        
                        <div className={styles.descContainer}>
                            <p className={styles.description}>
                                {detail.description || 'No description available for this designer item.'}
                            </p>
                        </div>

                        <div className={styles.metaGrid}>
                            <div className={styles.metaItem}>
                                <span className={styles.metaLabel}>Category</span>
                                <span className={styles.metaValue}>{detail.category || 'N/A'}</span>
                            </div>
                            <div className={styles.metaItem}>
                                <span className={styles.metaLabel}>Material</span>
                                <span className={styles.metaValue}>{detail.material || 'N/A'}</span>
                            </div>
                            <div className={styles.metaItem}>
                                <span className={styles.metaLabel}>Color</span>
                                <span className={styles.metaValue}>{detail.color || 'N/A'}</span>
                            </div>
                            <div className={styles.metaItem}>
                                <span className={styles.metaLabel}>Gender</span>
                                <span className={styles.metaValue}>{detail.gender || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Similar Recommendations Section */}
                <section className={styles.similarSection}>
                    <h2 className={styles.sectionTitle}>EDITORIAL RECOMMENDATIONS</h2>
                    <p className={styles.sectionSubtitle}>Discover similar designs curated by our multi-modal vector search index</p>
                    
                    {isSimilarLoading ? (
                        <div className={styles.loadingSimilar}>
                            <div className={styles.miniLoader}></div>
                            <span>Scanning similarity coordinates...</span>
                        </div>
                    ) : (
                        <MasonryGrid products={similar} searchContext={{ query: null, image: null }} />
                    )}
                </section>
            </main>
        </div>
    );
};

export default ProductDetail;