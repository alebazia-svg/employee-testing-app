import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'МОБО · Портал компании',
  applicationName: 'МОБО',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'МОБО',
  },
  icons: {
    icon: [
      { url: '/brand/mobo/pwa-wordmark-blue-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/brand/mobo/pwa-wordmark-blue-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/brand/mobo/pwa-wordmark-blue-180.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#111821',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang='ru'><body>{children}</body></html>;
}
