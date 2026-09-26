'use client';

import { AccountProvider, useAccount } from '@/features/account/AccountProvider';
import { LeaseProvider, useLease } from '@/features/leases/LeaseProvider';
import { TxProvider } from '@/features/tx/TxProvider';
import type { ReactNode } from 'react';

function AccountBoundary({ children }: { children: ReactNode }) {
  const { session } = useAccount();
  const { scenario } = useLease();
  return <TxProvider key={`${session?.address}:${session?.chainId}:${session?.method}:${scenario}`}>{children}</TxProvider>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AccountProvider>
      <LeaseProvider>
        <AccountBoundary>{children}</AccountBoundary>
      </LeaseProvider>
    </AccountProvider>
  );
}
