/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  turbopack: {},
  env: {
    NEXT_PUBLIC_PC_DOWNLOAD_URL: 'https://github.com/carlox7800/sugar_ludo_web/releases/download/v9.5.4/SugarLudo-v9.5.4-Setup.exe',
    NEXT_PUBLIC_ANDROID_DOWNLOAD_URL: 'https://github.com/carlox7800/sugar_ludo_web/releases/download/v9.5.4/SugarLudo-v9.5.4.apk',
  },
};

export default nextConfig;
