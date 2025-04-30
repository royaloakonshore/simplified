/** @type {import('next').NextConfig} */
const nextConfig = {
    // Restore the webpack configuration section
    webpack: (config, { isServer }) => {
        // Fixes npm packages that depend on 'fs', 'net', 'dns', etc.
        // See: https://github.com/vercel/next.js/issues/7755
        // And: https://github.com/vercel/next.js/pull/58712
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                net: false,
                dns: false,
                tls: false,
                child_process: false,
            };
        }

        // You can add other webpack customizations here if needed

        return config;
    },
     experimental: {
        // Recommended for Next.js 15, handles large Server Components better
        largePageDataBytes: 256 * 1000, // 256KB
    },
     // Optional: Add other Next.js configurations here
     // images: { domains: ['...'] },
     // reactStrictMode: true,
};

export default nextConfig; 