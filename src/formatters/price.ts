const usdPrice = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function formatUsd(price: number): string {
  return usdPrice.format(price);
}

export function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}
