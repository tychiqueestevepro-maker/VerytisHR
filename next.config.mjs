import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin(
  './src/i18n/request.ts'
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "puppeteer"],
};

export default withNextIntl(nextConfig);
