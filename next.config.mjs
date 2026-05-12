import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin(
  './src/i18n/request.ts'
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "puppeteer"],
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.verytis.com" }],
        destination: "https://verytis.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
