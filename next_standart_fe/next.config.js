const rawAsset = process.env.PUBLIC_ASSET_ORG || '';
const isLocalAsset = !rawAsset || rawAsset.includes('<') || rawAsset.includes('>') || rawAsset.includes('localhost') || rawAsset.includes('127.0.0.1');
const assetHost = (process.env.NODE_ENV === 'production' && isLocalAsset)
    ? 'https://worthy-illumination-production-844e.up.railway.app'
    : (rawAsset || 'http://127.0.0.1:8000');

/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
        ignoreDuringBuilds: true,
    },
    async rewrites() {
        return [
            {
                source: '/api/assets/:path*',
                destination: `${assetHost}/:path*`,
            },
            {
                source: '/uploads/:path*',
                destination: `${assetHost}/uploads/:path*`,
            },
        ];
    }
}

module.exports = nextConfig
