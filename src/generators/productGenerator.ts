import { faker } from '@faker-js/faker';
import { ProductCategory } from '../enums/productCategory';
import type { Product } from '../models/product';

/** Backend sends local timestamps without a timezone, e.g. `2026-11-25T03:01:09.271445`. */
const toBackendTimestamp = (date: Date): string =>
  date.toISOString().replace('Z', '');

export class ProductGenerator {
  generateProduct(overrides: Partial<Product> = {}): Product {
    const name = faker.commerce.productName();
    const createdAt = faker.date.recent({ days: 30 });
    const updatedAt = faker.date.between({ from: createdAt, to: new Date() });
    const reviewCount = faker.number.int({ min: 0, max: 50 });

    return {
      id: faker.number.int({ min: 1, max: 100_000 }),
      name,
      description: faker.commerce.productDescription(),
      price: faker.number.float({ min: 1, max: 2000, fractionDigits: 2 }),
      stockQuantity: faker.number.int({ min: 0, max: 200 }),
      category: faker.helpers.enumValue(ProductCategory),
      imageUrl: `/images/${faker.helpers.slugify(name).toLowerCase()}.png`,
      createdAt: toBackendTimestamp(createdAt),
      updatedAt: toBackendTimestamp(updatedAt),
      averageRating:
        reviewCount === 0
          ? null
          : faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
      reviewCount,
      ...overrides,
    };
  }

  /** Generates `count` products with unique ids, newest first (like the API). */
  generateProducts(
    count: number,
    overrides: Omit<Partial<Product>, 'id'> = {},
  ): Product[] {
    return Array.from({ length: count }, (_, index) =>
      this.generateProduct({ ...overrides, id: count - index }),
    );
  }
}
