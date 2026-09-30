import type { ReactNode } from 'react';
import './globals.css';
import { LiveProvider } from '@/features/live/LiveProvider';

export const metadata = {
  title: 'RentBond — Programmable Deposit Settlement',
  description: 'Partial-dispute rental deposit settlement on Monad testnet. Test assets have no cash value.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LiveProvider config={{ mode: process.env.NEXT_PUBLIC_APP_ENV ?? 'local', chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID), rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? '', factory: process.env.NEXT_PUBLIC_FACTORY_ADDRESS ?? '', confirmations: Number(process.env.CHAIN_CONFIRMATIONS ?? '1') }}>{children}</LiveProvider>
      </body>
    </html>
  );
}
