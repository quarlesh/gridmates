import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Crossword Party',
  description: 'A collaborative crossword experience',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
