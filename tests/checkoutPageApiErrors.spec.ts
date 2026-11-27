import { NO_MORE_REQUESTS_WINDOW_MS } from '@/config/timing';
import { test } from '@/fixtures/test';
import { AddressGenerator } from '@/generators/addressGenerator';
import { ProductGenerator } from '@/generators/productGenerator';
import type { CartMock } from '@/mocks/cartMock';
import type { FakeProductSearchMock } from '@/mocks/fakeProductSearchMock';

function seedCart(
  fakeProductSearchMock: FakeProductSearchMock,
  cartMock: CartMock,
) {
  const { products, first, second } = new ProductGenerator().generateCatalogue(
    2,
    { stockQuantity: 10 },
  );
  fakeProductSearchMock.products = products;
  const lines = [
    { product: first, quantity: 2 },
    { product: second, quantity: 1 },
  ];
  const items = lines.map(({ product, quantity }) => ({
    productId: product.id,
    quantity,
  }));
  cartMock.seed(items);
  return { lines, items, first };
}

test.describe('Checkout page API errors', {
  tag: ['@checkout', '@mocked', '@negative'],
}, () => {
  test('an availability conflict keeps the cart and the address', async ({
    checkoutPage,
    fakeProductSearchMock,
    cartMock,
    checkoutMock,
  }) => {
    const { lines, items, first } = seedCart(fakeProductSearchMock, cartMock);
    const address = new AddressGenerator().generate();
    checkoutMock.limitStock(first.id, 1);
    await checkoutPage.goto();
    await checkoutPage.expectToShowCart(lines);
    await checkoutPage.fillAddress(address);

    await checkoutPage.placeOrder();

    await checkoutPage.expectAvailabilityConflict();
    await checkoutPage.expectAddressKept(address);
    await cartMock.expectCartItems(items);
    await checkoutMock.expectOrdersToStay(0, NO_MORE_REQUESTS_WINDOW_MS);
  });

  test('a server error shows its message and is not retried', async ({
    checkoutPage,
    fakeProductSearchMock,
    cartMock,
    checkoutMock: _checkoutMock,
    apiErrorMock,
  }) => {
    const { lines, items } = seedCart(fakeProductSearchMock, cartMock);
    const address = new AddressGenerator().generate();
    await apiErrorMock.respondWithError('orders', 500, {
      message: 'Order service failed',
    });
    await checkoutPage.goto();
    await checkoutPage.expectToShowCart(lines);
    await checkoutPage.fillAddress(address);

    await checkoutPage.placeOrder();

    await checkoutPage.expectSubmitError('Order service failed');
    await checkoutPage.expectAddressKept(address);
    await cartMock.expectCartItems(items);
    await apiErrorMock.expectRequestCountToStay(
      'orders',
      1,
      NO_MORE_REQUESTS_WINDOW_MS,
    );
  });

  test('address errors from the server are shown on their fields', async ({
    checkoutPage,
    fakeProductSearchMock,
    cartMock,
    checkoutMock,
  }) => {
    const { lines, items } = seedCart(fakeProductSearchMock, cartMock);
    const address = new AddressGenerator().generate();
    const fieldErrors = {
      street: 'Street must not be blank',
      zipCode: 'Invalid zip code',
    };
    await checkoutMock.rejectAddress(fieldErrors);
    await checkoutPage.goto();
    await checkoutPage.expectToShowCart(lines);
    await checkoutPage.fillAddress(address);

    await checkoutPage.placeOrder();

    await checkoutPage.expectFieldErrors(fieldErrors);
    await checkoutPage.expectReadyToPlace();
    await cartMock.expectCartItems(items);
    await checkoutMock.expectOrdersToStay(0, NO_MORE_REQUESTS_WINDOW_MS);
  });

  test('a dropped connection can be retried with the same idempotency key', {
    tag: '@network',
  }, async ({
    checkoutPage,
    paymentPage,
    fakeProductSearchMock,
    cartMock,
    checkoutMock,
    networkErrorMock,
  }) => {
    const { lines, items } = seedCart(fakeProductSearchMock, cartMock);
    const address = new AddressGenerator().generate();
    await networkErrorMock.abort('orders', {
      times: 1,
      errorCode: 'internetdisconnected',
    });
    await checkoutPage.goto();
    await checkoutPage.expectToShowCart(lines);
    await checkoutPage.fillAddress(address);

    await checkoutPage.placeOrder();

    await checkoutPage.expectSubmitError(
      'Failed to create order. Please try again.',
    );
    await checkoutPage.expectAddressKept(address);
    await cartMock.expectCartItems(items);
    await networkErrorMock.expectAbortedCountToStay(
      'orders',
      1,
      NO_MORE_REQUESTS_WINDOW_MS,
    );

    await checkoutPage.placeOrder();

    await paymentPage.expectToShowOrder(await checkoutMock.waitForOrder());
    await checkoutMock.expectPlacedOrder(address);
    await checkoutMock.expectAttemptsToShareIdempotencyKey(2);
  });
});
