export const featureTags = [
  'auth',
  'products',
  'product-details',
  'cart',
  'checkout',
] as const;

export const dataTags = ['@mocked', '@live'] as const;

export function tagPattern(tag: string): RegExp {
  return new RegExp(`@${tag}(?![\\w-])`);
}

export function tagPolicyViolations(tags: string[]): string[] {
  const features = featureTags.filter((feature) =>
    tags.includes(`@${feature}`),
  );
  const data = dataTags.filter((tag) => tags.includes(tag));
  const violations: string[] = [];
  if (features.length !== 1) {
    violations.push(
      `exactly one feature tag (${featureTags.map((f) => `@${f}`).join(', ')}), found ${features.length}`,
    );
  }
  if (data.length !== 1) {
    violations.push(
      `exactly one data tag (${dataTags.join(', ')}), found ${data.length}`,
    );
  }
  return violations;
}
