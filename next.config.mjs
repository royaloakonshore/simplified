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
                child_process: false, // Be cautious with this one if not strictly needed
            };
        }
        return config;
    },
    // // Optional: Add other Next.js configurations here
    // // images: { domains: ['...'] },
    // // reactStrictMode: true,
};

export default nextConfig; 