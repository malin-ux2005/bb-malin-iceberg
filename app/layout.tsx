import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin', 'cyrillic'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin', 'cyrillic'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://bb-malin-iceberg.ddmalin.chatgpt.site'),
  title: 'Пик / Айсберг — BB Malin',
  description:
    'Общий интерактивный айсберг истории BOLSHIE BROTHERS MALIN.',
  openGraph: {
    title: 'Пик / Айсберг — BB Malin',
    description: 'Общая интерактивная история BOLSHIE BROTHERS MALIN.',
    type: 'website',
    locale: 'ru_RU',
    images: [{ url: '/og.jpg', width: 1536, height: 1024, alt: 'Пик / Айсберг BB Malin' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Пик / Айсберг — BB Malin',
    description: 'Общая интерактивная история BOLSHIE BROTHERS MALIN.',
    images: ['/og.jpg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
