import { expect, type Locator, type Page } from '@playwright/test';
import { CheckoutItemRow } from '@/components/checkoutItemRow';
import { formatUsd } from '@/formatters/price';
import type {
  Address,
  AddressField,
  FieldErrors,
  TaxPreview,
} from '@/models/order';
import type { Product } from '@/models/product';
import type { Locators } from '@/types/locators';
import { BasePage } from './basePage';

const ADDRESS_FIELDS: AddressField[] = [
  'street',
  'city',
  'state',
  'zipCode',
  'country',
];

const FIELD_TEST_ID: Record<AddressField, string> = {
  street: 'street',
  city: 'city',
  state: 'state',
  zipCode: 'zip',
  country: 'country',
};

const REQUIRED_MESSAGES: Record<AddressField, string> = {
  street: 'Street address is required',
  city: 'City is required',
  state: 'State is required',
  zipCode: 'ZIP code is required',
  country: 'Country is required',
};

const ZIP_FORMAT_MESSAGE = 'Invalid postal/zip code format';

const AVAILABILITY_MESSAGE =
  'Some items are no longer available in the requested quantity. Your cart was preserved; review it before trying again.';

type CartLine = { product: Product; quantity: number };

export class CheckoutPage extends BasePage {
  readonly url = '/checkout';
  readonly title = 'Checkout – Awesome Testing';

  readonly heading: Locator;
  readonly form: Locator;
  readonly loading: Locator;
  readonly itemRows: Locator;
  readonly buttons: Locators<'placeOrder' | 'back'>;

  readonly inputs: Locators<AddressField>;
  readonly errors: Locators<AddressField>;
  readonly texts: Locators<
    | 'itemsCount'
    | 'summaryTotal'
    | 'formTotal'
    | 'taxLabel'
    | 'taxAmount'
    | 'taxUnavailable'
  >;
  readonly alerts: Locators<'submit' | 'availability'>;

  constructor(page: Page) {
    super(page);

    this.heading = page.getByTestId('checkout-title');
    this.form = page.getByTestId('checkout-form');
    this.loading = page.getByTestId('checkout-loading');
    this.itemRows = page.getByTestId('checkout-items-list').getByRole('row');
    this.buttons = {
      placeOrder: page.getByTestId('checkout-submit-button'),
      back: page.getByTestId('checkout-back-button'),
    };

    const field = (part: 'input' | 'error') =>
      Object.fromEntries(
        ADDRESS_FIELDS.map((name) => [
          name,
          page.getByTestId(`checkout-${FIELD_TEST_ID[name]}-${part}`),
        ]),
      ) as Record<AddressField, Locator>;
    this.inputs = field('input');
    this.errors = field('error');

    this.texts = {
      itemsCount: page.getByTestId('checkout-items-value'),
      summaryTotal: page.getByTestId('checkout-total-value'),
      formTotal: page.getByTestId('checkout-total-amount'),
      taxLabel: page.getByTestId('checkout-tax-label'),
      taxAmount: page.getByTestId('checkout-tax-amount'),
      taxUnavailable: page.getByTestId('checkout-tax-unavailable'),
    };

    this.alerts = {
      submit: page.getByTestId('checkout-submit-error'),
      availability: page.getByTestId('checkout-availability-error'),
    };
  }

  item(productId: number): CheckoutItemRow {
    return new CheckoutItemRow(this.page, productId);
  }

  async fillAddress(address: Partial<Address>): Promise<void> {
    for (const name of ADDRESS_FIELDS) {
      const value = address[name];
      if (value !== undefined) {
        await this.inputs[name].fill(value);
      }
    }
  }

  async placeOrder(): Promise<void> {
    await this.buttons.placeOrder.click();
  }

  async forcePlaceOrder(): Promise<void> {
    await this.buttons.placeOrder.click({ force: true });
    await this.buttons.placeOrder.dispatchEvent('click');
  }

  async backToCart(): Promise<void> {
    await this.buttons.back.click();
  }

  async expectToShowCart(lines: CartLine[]): Promise<void> {
    await this.expectToBeOpen();
    await expect(this.heading).toHaveText('Checkout');
    await expect(this.loading).toBeHidden();
    await expect(this.itemRows).toHaveCount(lines.length);
    for (const { product, quantity } of lines) {
      await this.item(product.id).expectToShow(product, quantity);
    }
    const totalItems = lines.reduce(
      (total, { quantity }) => total + quantity,
      0,
    );
    const totalPrice = formatUsd(
      lines.reduce(
        (total, { product, quantity }) => total + product.price * quantity,
        0,
      ),
    );
    await expect(this.texts.itemsCount).toHaveText(String(totalItems));
    await expect(this.texts.summaryTotal).toHaveText(totalPrice);
    await expect(this.texts.formTotal).toHaveText(totalPrice);
    await this.expectCartCount(totalItems);
    await this.expectReadyToPlace();
  }

  async expectStillLoading(): Promise<void> {
    await expect(this.loading).toHaveText('Loading checkout...');
    await expect(this.form).toBeHidden();
  }

  async expectVat(preview: TaxPreview): Promise<void> {
    await expect(this.texts.taxLabel).toHaveText(
      `Includes VAT ${preview.rate}% (${preview.country})`,
    );
    await expect(this.texts.taxAmount).toHaveText(formatUsd(preview.taxAmount));
    await expect(this.texts.taxUnavailable).toBeHidden();
  }

  async expectNoVatFor(country: string): Promise<void> {
    await expect(this.texts.taxUnavailable).toHaveText(
      `No VAT rate for "${country}"; the order is placed without VAT.`,
    );
    await expect(this.texts.taxLabel).toBeHidden();
  }

  async expectFieldErrors(errors: FieldErrors): Promise<void> {
    for (const name of ADDRESS_FIELDS) {
      const message = errors[name];
      if (message === undefined) {
        await expect(this.errors[name]).toBeHidden();
        await expect(this.inputs[name]).not.toHaveAttribute(
          'aria-invalid',
          'true',
        );
      } else {
        await expect(this.errors[name]).toHaveText(message);
        await expect(this.inputs[name]).toHaveAttribute('aria-invalid', 'true');
      }
    }
  }

  async expectValidationErrors({
    required = [],
    invalidZip = false,
  }: {
    required?: AddressField[];
    invalidZip?: boolean;
  }): Promise<void> {
    const errors: FieldErrors = {};
    for (const name of required) {
      errors[name] = REQUIRED_MESSAGES[name];
    }
    if (invalidZip) {
      errors.zipCode = ZIP_FORMAT_MESSAGE;
    }
    await this.expectFieldErrors(errors);
    await expect(this.alerts.submit).toBeHidden();
  }

  async expectProcessing(): Promise<void> {
    await expect(this.buttons.placeOrder).toHaveText('Processing...');
    await expect(this.buttons.placeOrder).toBeDisabled();
  }

  async expectReadyToPlace(): Promise<void> {
    await expect(this.buttons.placeOrder).toHaveText('Place Order');
    await expect(this.buttons.placeOrder).toBeEnabled();
  }

  async expectAvailabilityConflict(): Promise<void> {
    await expect(this.alerts.availability).toHaveAttribute('role', 'alert');
    await expect(this.alerts.availability).toHaveText(AVAILABILITY_MESSAGE);
    await expect(this.alerts.submit).toBeHidden();
    await this.expectReadyToPlace();
  }

  async expectSubmitError(message: string): Promise<void> {
    await expect(this.alerts.submit).toHaveAttribute('role', 'alert');
    await expect(this.alerts.submit).toHaveText(message);
    await expect(this.alerts.availability).toBeHidden();
    await this.expectReadyToPlace();
  }

  async expectAddressKept(address: Address): Promise<void> {
    await this.expectToBeOpen();
    for (const name of ADDRESS_FIELDS) {
      await expect(this.inputs[name]).toHaveValue(address[name]);
    }
  }
}
