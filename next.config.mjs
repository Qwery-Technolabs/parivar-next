/** @type {import('next').NextConfig} */
const nextConfig = {
    // Dev only: Next 16 serves its dev scripts to localhost alone. Opening the dev server from a
    // phone on the same Wi-Fi (http://192.168.x.x:3000) would load the HTML but not the JS, so no
    // menu, popup or drawer would open. Private LAN ranges are allowed; production is unaffected.
    allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.*.*.*', '*.local'],
};

export default nextConfig;
