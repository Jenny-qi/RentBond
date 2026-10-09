import Image from 'next/image';

export function BrandLogo() {
  return <Image
    src="/brand/logo-horizontal-nav.svg?v=20261008"
    alt="RentBond"
    width={180}
    height={48}
    className="brand-logo"
    unoptimized
  />;
}
