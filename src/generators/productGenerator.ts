import { en, Faker } from '@faker-js/faker';
import { ProductCategory } from '../enums/productCategory';
import type { Product } from '../models/product';

/** Images that exist on the server, so mocked products render without broken images. */
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

/** Backend sends local timestamps without a timezone, e.g. `2026-11-25T03:01:09.271445`. */
const toBackendTimestamp = (date: Date): string =>
  date.toISOString().replace('Z', '');

const fromBackendTimestamp = (timestamp: string): Date =>
  new Date(`${timestamp}Z`);

export class ProductGenerator {
  private readonly faker: Faker;

  /** Pass a seed to get the same products on every run. */
  constructor(seed?: number) {
    this.faker = new Faker({ locale: [en] });
    if (seed !== undefined) {
      this.faker.seed(seed);
    }
  }

  /**
   * Generates one product. Fields that depend on each other are derived after
   * applying overrides, so e.g. `{ reviewCount: 0 }` yields a null rating.
   */
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

  /** Generates `count` products with unique ids, newest first like the API's default sort. */
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

  /** Keeps reviewCount consistent with an overridden averageRating. */
  private defaultReviewCount({ averageRating }: Partial<Product>): number {
    if (averageRating === null) {
      return 0;
    }
    const min = averageRating === undefined ? 0 : 1;
    return this.faker.number.int({ min, max: MAX_REVIEWS });
  }

  /** Never earlier than createdAt, even when createdAt is in the future. */
  private updatedAfter(createdAt: string): string {
    const from = fromBackendTimestamp(createdAt);
    const to = new Date(Math.max(from.getTime(), Date.now()));
    const updatedAt = this.faker.date.between({ from, to });
    // Reuse createdAt verbatim so its sub-millisecond digits aren't truncated.
    return updatedAt > from ? toBackendTimestamp(updatedAt) : createdAt;
  }

  /** Average of 1-5 star reviews rounded half-up to one decimal; null without reviews. */
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
