export const MONAD_TESTNET = {
  chainId: 10143,
  name: 'Monad Testnet',
  explorerUrl: 'https://testnet.monadexplorer.com',
  nativeCurrency: 'MON',
} as const;

export function explorerTx(hash: string): string {
  return `${MONAD_TESTNET.explorerUrl}/tx/${hash}`;
}

export function explorerAddress(address: string): string {
  return `${MONAD_TESTNET.explorerUrl}/address/${address}`;
}

export function shortenAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
