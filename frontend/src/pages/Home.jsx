import React, { useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSearchResults, clearResults } from '../../features/search/searchSlice';
import MasonryGrid from '../components/MasonryGrid/MasonryGrid'; 
import styles from './Home.module.scss';

const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
};

const Home = () => {
    const [query, setQuery] = useState('');
    const [imageBase64, setImageBase64] = useState(null); 
    const [previewUrl, setPreviewUrl] = useState(null);   
    const [localError, setLocalError] = useState(null);
    const fileInputRef = useRef(null);

    const dispatch = useDispatch();
    const { results, isLoading, error } = useSelector((state) => state.search);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setLocalError(null);
        if (!query.trim() && !imageBase64) return;

        dispatch(fetchSearchResults({ 
            query: query.trim() || null, 
            image: imageBase64 
        }));
    };

    const handleCategoryClick = (keyword) => {
        setQuery(''); 
        setImageBase64(null); 
        setPreviewUrl(null);
        setLocalError(null);

        dispatch(fetchSearchResults({ 
            query: keyword, 
            image: null 
        }));
    };

    const handleClear = () => {
        setQuery('');
        setImageBase64(null);
        setPreviewUrl(null);
        setLocalError(null);
        dispatch(clearResults());
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLocalError(null);

        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            setLocalError('System only supports JPG, PNG, or WEBP formats.');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setLocalError('Image size exceeds the 5MB limit.');
            return;
        }

        try {
            const fullBase64 = await convertFileToBase64(file);
            setPreviewUrl(fullBase64);
            const base64DataOnly = fullBase64.split(',')[1];
            setImageBase64(base64DataOnly);
        } catch (err) {
            setLocalError('Unable to process the uploaded image.');
        } finally {
            e.target.value = '';
        }
    };

    const displayError = localError || error;

    return (
        <div className={styles.page}>
            {/* STICKY NAVBAR */}
            <nav className={styles.navbar}>
                <div className={styles.navContainer}>
                    <div className={styles.logo} onClick={handleClear}>
                        FASHION <span className={styles.goldText}>AI</span>
                    </div>
                    <div className={styles.navStatus}>
                        <span className={styles.pulseIndicator}></span>
                        <span>STUDIO ACTIVE</span>
                    </div>
                </div>
            </nav>

            <header className={styles.hero}>
                <div className={styles.welcomeBadge}>
                    <span>✨ STUDIO SEARCH ENGINE ✨</span>
                </div>
                <h1 className={styles.title}>
                    Shape Your Style in the <span className={styles.highlight}>Digital Era</span>
                </h1>
                <p className={styles.subtitle}>
                    An intelligent hybrid search platform powered by multi-modal AI. 
                    Instantly browse and discover designer wear, footwear, and accessories using image or natural language queries.
                </p>

                <div className={styles.categories}>
                    <button type="button" className={styles.catBadge} onClick={() => handleCategoryClick('long dress')}>Women's Clothing</button>
                    <button type="button" className={styles.catBadge} onClick={() => handleCategoryClick('men polo')}>Men's Clothing</button>
                    <button type="button" className={styles.catBadge} onClick={() => handleCategoryClick('shoes')}>Footwear</button>
                </div>
            </header>

            <main className={styles.mainContent}>
                {previewUrl && (
                    <div className={styles.previewContainer}>
                        <div className={styles.previewBox}>
                            <img src={previewUrl} alt="Visual Search Query" />
                            <button type="button" onClick={() => { setImageBase64(null); setPreviewUrl(null); }} className={styles.removeImageBtn} title="Remove image">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <p className={styles.previewLabel}>Active Visual Context</p>
                    </div>
                )}

                <form className={styles.searchBar} onSubmit={handleSearchSubmit}>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Describe the item you want to find (e.g., white silk shirt, straight jeans)..."
                        className={styles.searchInput}
                        disabled={isLoading}
                    />
                    <button type="button" onClick={triggerFileInput} className={styles.iconButton} title="Upload an image for smart search">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                            <circle cx="12" cy="13" r="4"/>
                        </svg>
                    </button>
                    <button type="submit" className={styles.searchButton} disabled={isLoading}>
                        {isLoading ? 'Analyzing...' : 'AI Search'}
                    </button>
                    {(query || imageBase64) && (
                        <button type="button" onClick={handleClear} className={styles.clearButton} title="Reset search">
                            Reset
                        </button>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} hidden />
                </form>

                {displayError && <div className={styles.errorBox}>{displayError}</div>}

                {isLoading && (
                    <div className={styles.loadingState}>
                        <div className={styles.loaderContainer}>
                            <div className={styles.loaderCircle}></div>
                            <div className={styles.loaderGlow}></div>
                        </div>
                        <p className={styles.loadingStatus}>DECODING VECTOR EMBEDDINGS</p>
                        <p className={styles.loadingSubtext}>Extracting mathematical feature vectors from your data...</p>
                    </div>
                )}

                {!isLoading && Array.isArray(results) && results.length > 0 && (
                    <section className={styles.resultsSection}>
                        <h2 className={styles.sectionTitle}>Top AI Recommended Products</h2>
                        <MasonryGrid products={results} searchContext={{ query, image: null }} />
                    </section>
                )}

                {!isLoading && (!results || results.length === 0) && !displayError && (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>💡</div>
                        <p className={styles.emptyText}>
                            Quick Tip: Try uploading a photo of a jacket or type keywords like "running shoes" to experience our advanced vector search technology.
                        </p>
                    </div>
                )}
            </main>

            <footer className={styles.footer}>
                <div className={styles.footerContainer}>
                    <div className={styles.footerBrandBlock}>
                        <h3>Fashion<span className={styles.goldText}>AI</span></h3>
                        <p>An intelligent hybrid search system powered by state-of-the-art Computer Vision and Large Language Models.</p>
                    </div>
                    <div className={styles.footerLinksBlock}>
                        <h4>Categories</h4>
                        <ul>
                            <li onClick={() => handleCategoryClick('jeans')}>Men / Women Jeans</li>
                            <li onClick={() => handleCategoryClick('shirt')}>Office Shirts</li>
                            <li onClick={() => handleCategoryClick('sneakers')}>Sneakers & Sports</li>
                        </ul>
                    </div>
                    <div className={styles.footerNewsletter}>
                        <h4>Tech Newsletter</h4>
                        <p>Subscribe to receive updates about new algorithms and latest fashion collections.</p>
                        <div className={styles.subscribeForm}>
                            <input type="email" placeholder="Your Email Address" disabled />
                            <button type="button">Subscribe</button>
                        </div>
                    </div>
                </div>
                <div className={styles.footerBottom}>
                    <p>© 2026 FashionAI Search System. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default Home;