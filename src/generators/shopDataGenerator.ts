import { en, Faker } from '@faker-js/faker';
import type { InventoryItem } from '@/models/inventory';
import type { Order } from '@/models/order';
import type { ProductDetails } from '@/models/product';
import { AddressGenerator } from './addressGenerator';
import { ProductGenerator, toProductDetails } from './productGenerator';
import { BASE_TIMESTAMP } from './timestamps';

export class ShopDataGenerator {
  private readonly faker: Faker;
  private readonly products: ProductGenerator;
  private readonly addresses: AddressGenerator;

  constructor(seed?: number) {
    this.faker = new Faker({ locale: [en] });
    if (seed !== undefined) {
      this.faker.seed(seed);
    }
    this.products = new ProductGenerator(seed);
    this.addresses = new AddressGenerator(seed);
  }

  product(
    id: number,
    overrides: Omit<Partial<ProductDetails>, 'id'> = {},
  ): ProductDetails {
    return toProductDetails(
      this.products.generateProduct({ ...overrides, id }),
    );
  }

  order(id: number, overrides: Omit<Partial<Order>, 'id'> = {}): Order {
    const total = this.faker.number.float({
      min: 1,
      max: 2000,
      fractionDigits: 2,
    });
    const totalAmount = overrides.totalAmount ?? total;
    const createdAt = overrides.createdAt ?? BASE_TIMESTAMP;
    return {
      id,
      username: this.faker.internet.username(),
      items: [
        {
          id: id * 10,
          productId: id,
          quantity: 1,
          productName: this.faker.commerce.productName(),
          unitPrice: totalAmount,
          totalPrice: totalAmount,
        },
      ],
      totalAmount,
      subtotalAmount: totalAmount,
      discountAmount: 0,
      couponCode: null,
      status: 'PENDING',
      taxCountry: null,
      taxRate: null,
      taxAmount: null,
      netAmount: null,
      reservationExpiresAt: null,
      shippingAddress: this.addresses.generate(),
      createdAt,
      updatedAt: createdAt,
      ...overrides,
    };
  }

  inventoryItem(
    productId: number,
    overrides: Omit<Partial<InventoryItem>, 'productId'> = {},
  ): InventoryItem {
    return {
      productId,
      name: this.faker.commerce.productName(),
      category: this.faker.commerce.department(),
      availableQuantity: this.faker.number.int({ min: 10, max: 100 }),
      stockStatus: 'IN_STOCK',
      lastChangedAt: BASE_TIMESTAMP,
      ...overrides,
    };
  }
}
