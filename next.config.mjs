/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                net: false,
                dns: false,
                tls: false,
                child_process: false,
                puppeteer: false,
            };
            
            // Exclude Puppeteer from client-side bundle
            config.externals = config.externals || [];
            config.externals.push('puppeteer');
        }
        return config;
    },
    // Server external packages for better server-side handling
    serverExternalPackages: ['puppeteer'],
};

export default nextConfig; 