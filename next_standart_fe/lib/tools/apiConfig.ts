/**
 * @file apiConfig.ts
 * @description Helper terpusat untuk URL API backend dan assets dengan fallback cerdas untuk deployment Railway
 */

const RAILWAY_BACKEND_URL = 'https://worthy-illumination-production-844e.up.railway.app';
const LOCAL_BACKEND_URL = 'http://localhost:8000';

export const getBackendApiUrl = (): string => {
    let url = process.env.API_URL || process.env.NEXT_PUBLIC_URL_API || process.env.NEXT_PUBLIC_API_BASE_URL || '';

    // Jika di production tapi url masih kosong, placeholder, atau mengarah ke localhost/127.0.0.1
    const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
    if (process.env.NODE_ENV === 'production' && (!url || url.includes('<') || url.includes('>') || isLocalhost)) {
        return `${RAILWAY_BACKEND_URL}/api/v1`;
    }

    if (!url || url.includes('<') || url.includes('>')) {
        return `${LOCAL_BACKEND_URL}/api/v1`;
    }

    url = url.endsWith('/') ? url.slice(0, -1) : url;

    if (!url.endsWith('/api/v1')) {
        url = `${url}/api/v1`;
    }

    return url;
};

export const getAssetBaseUrl = (): string => {
    const rawAsset = process.env.PUBLIC_ASSET_ORG || process.env.NEXT_PUBLIC_ASSET_URL || '';
    const isLocalAsset = !rawAsset || rawAsset.includes('<') || rawAsset.includes('>') || rawAsset.includes('localhost') || rawAsset.includes('127.0.0.1');

    if (process.env.NODE_ENV === 'production' && isLocalAsset) {
        return RAILWAY_BACKEND_URL;
    }

    if (!rawAsset || rawAsset.includes('<') || rawAsset.includes('>')) {
        return LOCAL_BACKEND_URL;
    }

    return rawAsset.endsWith('/') ? rawAsset.slice(0, -1) : rawAsset;
};

export const getAssetUrl = (path?: string): string => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
        return path;
    }
    const clean = path.startsWith('/') ? path : `/${path}`;
    // Jika di browser client, Next.js rewrites menangani /uploads dan /api/assets
    if (typeof window !== 'undefined') {
        return clean;
    }
    return `${getAssetBaseUrl()}${clean}`;
};
