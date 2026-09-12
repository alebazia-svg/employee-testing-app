import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Портал команды',
  applicationName: 'Портал команды',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Портал',
  },
  icons: {
    icon: [
      { url: '/portal-app-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/portal-app-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/portal-app-icon-180.png', sizes: '180x180', type: 'image/png' }],
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
