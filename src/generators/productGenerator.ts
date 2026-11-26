import { en, Faker } from '@faker-js/faker';
import { ProductCategory } from '@/enums/productCategory';
import type { Product } from '@/models/product';

const PRODUCT_IMAGES = [
  '/images/iphone.png',
  '/images/samsung.png',
  '/images/mac.png',
  '/images/ps5.png',
  '/images/ninja.png',
  '/images/cleancode.png',
  '/images/applewatch.png',
  '/images/sony.png',
] as const;

const MAX_REVIEWS = 50;

const toBackendTimestamp = (date: Date): string =>
  date.toISOString().replace('Z', '');

const fromBackendTimestamp = (timestamp: string): Date =>
  new Date(`${timestamp}Z`);

export class ProductGenerator {
  private readonly faker: Faker;

  constructor(seed?: number) {
    this.faker = new Faker({ locale: [en] });
    if (seed !== undefined) {
      this.faker.seed(seed);
    }
  }

  generateProduct(overrides: Partial<Product> = {}): Product {
    const { faker } = this;

    const createdAt =
      overrides.createdAt ??
      toBackendTimestamp(faker.date.recent({ days: 30 }));
    const reviewCount =
      overrides.reviewCount ?? this.defaultReviewCount(overrides);

    return {
      id: faker.number.int({ min: 1, max: 100_000 }),
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      price: faker.number.float({ min: 1, max: 2000, fractionDigits: 2 }),
      stockQuantity: faker.number.int({ min: 0, max: 200 }),
      category: faker.helpers.enumValue(ProductCategory),
      imageUrl: faker.helpers.arrayElement(PRODUCT_IMAGES),
      ...overrides,
      createdAt,
      updatedAt: overrides.updatedAt ?? this.updatedAfter(createdAt),
      averageRating:
        overrides.averageRating !== undefined
          ? overrides.averageRating
          : this.averageRating(reviewCount),
      reviewCount,
    };
  }

  generateProducts(
    count: number,
    overrides: Omit<Partial<Product>, 'id'> = {},
  ): Product[] {
    const createdDates = this.faker.helpers
      .multiple(() => this.faker.date.recent({ days: 30 }), { count })
      .sort((a, b) => b.getTime() - a.getTime());

    return createdDates.map((createdAt, index) =>
      this.generateProduct({
        createdAt: toBackendTimestamp(createdAt),
        ...overrides,
        id: count - index,
      }),
    );
  }

  private defaultReviewCount({ averageRating }: Partial<Product>): number {
    if (averageRating === null) {
      return 0;
    }
    const min = averageRating === undefined ? 0 : 1;
    return this.faker.number.int({ min, max: MAX_REVIEWS });
  }

  private updatedAfter(createdAt: string): string {
    const from = fromBackendTimestamp(createdAt);
    const to = new Date(Math.max(from.getTime(), Date.now()));
    const updatedAt = this.faker.date.between({ from, to });
    return updatedAt > from ? toBackendTimestamp(updatedAt) : createdAt;
  }

  private averageRating(reviewCount: number): number | null {
    if (reviewCount === 0) {
      return null;
    }
    const stars = this.faker.helpers.multiple(
      () => this.faker.number.int({ min: 1, max: 5 }),
      { count: reviewCount },
    );
    const sum = stars.reduce((total, star) => total + star, 0);
    return Math.round((sum * 10) / reviewCount) / 10;
  }
}
