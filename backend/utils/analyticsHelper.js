// Tạo session_id tồn tại theo phiên truy cập (Session Storage)
const getSessionId = () => {
    let sid = sessionStorage.getItem('fashion_session_id');
    if (!sid) {
        sid = 'sess_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        sessionStorage.setItem('fashion_session_id', sid);
    }
    return sid;
};

export const trackEvent = (eventType, payload = {}) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
    
    const data = {
        session_id: getSessionId(),
        event_type: eventType,
        screen_width: window.innerWidth,
        ...payload
    };

    // Ưu tiên dùng sendBeacon vì nó không block luồng UI và vẫn chạy khi unmount component
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const success = navigator.sendBeacon(`${API_URL}/analytics/events`, blob);

    // Fallback dùng fetch nếu browser không hỗ trợ sendBeacon
    if (!success) {
        fetch(`${API_URL}/analytics/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            keepalive: true
        }).catch(e => console.error('Tracking failed', e));
    }
};