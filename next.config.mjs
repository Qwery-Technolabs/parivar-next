/** @type {import('next').NextConfig} */
const nextConfig = {
    // Dev only: Next 16 serves its dev scripts to localhost alone. Opening the dev server from a
    // phone on the same Wi-Fi (http://192.168.x.x:3000) would load the HTML but not the JS, so no
    // menu, popup or drawer would open. Private LAN ranges are allowed; production is unaffected.
    allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.*.*.*', '*.local'],
    experimental: {
        // Pages fetched in the background (components/shell/background-prefetch.jsx) are reused for
        // 3 minutes — instant to open, yet never far behind; any save (revalidatePath) drops them early.
        staleTimes: { static: 180 },
    },
    async headers() {
        return [
            // The built-in favicon (shown until a Samaj logo is saved): cached for 7 days.
            { source: '/favicon.ico', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }] },
            // The web manifest: the browser asks for it on every page — let it keep its copy for a day.
            { source: '/manifest.webmanifest', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }] },
        ];
    },
};

export default nextConfig;
