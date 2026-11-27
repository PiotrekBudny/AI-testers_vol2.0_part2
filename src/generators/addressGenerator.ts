import { en, Faker } from '@faker-js/faker';
import type { Address } from '@/models/order';

export class AddressGenerator {
  private readonly faker: Faker;

  constructor(seed?: number) {
    this.faker = new Faker({ locale: [en] });
    if (seed !== undefined) {
      this.faker.seed(seed);
    }
  }

  generate(overrides: Partial<Address> = {}): Address {
    const { faker } = this;
    return {
      street: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state(),
      zipCode: faker.helpers.replaceSymbols('##-###'),
      country: 'Poland',
      ...overrides,
    };
  }
}
