import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata = { title: { default: 'Recon', template: '%s · Recon' }, description: 'Order, payment and return reconciliation for D2C finance teams' };
export const viewport = { themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f6f7f9' }, { media: '(prefers-color-scheme: dark)', color: '#0c0e12' }] };

export default function RootLayout({ children }) {
  return (
    <html lang="en-IN" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
