import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata = {
  title: 'RentBond — Programmable Deposit Settlement',
  description: 'Monad 测试网押金部分结算原型。测试资产无现金价值。',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hans">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
