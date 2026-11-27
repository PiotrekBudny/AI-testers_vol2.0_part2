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
  cartMock.seed(
    lines.map(({ product, quantity }) => ({ productId: product.id, quantity })),
  );
  return lines;
}

test.describe('Checkout page', {
  tag: ['@checkout', '@mocked'],
}, () => {
  test('client places an order and lands on the payment page', async ({
    checkoutPage,
    paymentPage,
    fakeProductSearchMock,
    cartMock,
    checkoutMock,
  }) => {
    const lines = seedCart(fakeProductSearchMock, cartMock);
    const address = new AddressGenerator().generate();
    await checkoutPage.goto();
    await checkoutPage.expectToShowCart(lines);

    await checkoutPage.fillAddress(address);
    await checkoutPage.expectVat(await checkoutMock.waitForTaxPreview());
    await checkoutPage.placeOrder();

    await paymentPage.expectToShowOrder(await checkoutMock.waitForOrder());
    await checkoutMock.expectPlacedOrder(address);
    await cartMock.expectCartItems([]);
    await paymentPage.expectCartCount(0);
  });

  test('a country without a VAT rate is shown as ordered without VAT', async ({
    checkoutPage,
    paymentPage,
    fakeProductSearchMock,
    cartMock,
    checkoutMock,
  }) => {
    const lines = seedCart(fakeProductSearchMock, cartMock);
    await checkoutPage.goto();
    await checkoutPage.expectToShowCart(lines);

    await checkoutPage.fillAddress(
      new AddressGenerator().generate({ country: 'Atlantis' }),
    );

    await checkoutPage.expectNoVatFor('Atlantis');

    await checkoutPage.placeOrder();

    await paymentPage.expectToShowOrder(await checkoutMock.waitForOrder());
  });

  test('checkout with an empty cart sends the client back to the cart', async ({
    checkoutPage,
    cartPage,
    cartMock: _cartMock,
  }) => {
    await checkoutPage.goto();

    await cartPage.expectToBeOpen();
    await cartPage.expectEmpty();
  });

  test('checkout shows a loading state until the cart arrives', async ({
    checkoutPage,
    fakeProductSearchMock,
    cartMock,
  }) => {
    const lines = seedCart(fakeProductSearchMock, cartMock);
    const releaseCart = cartMock.holdReads();

    await checkoutPage.goto();

    await checkoutPage.expectStillLoading();
    releaseCart();
    await checkoutPage.expectToShowCart(lines);
  });

  test('repeated clicks while the order is pending send one request', async ({
    checkoutPage,
    paymentPage,
    fakeProductSearchMock,
    cartMock,
    checkoutMock,
  }) => {
    const lines = seedCart(fakeProductSearchMock, cartMock);
    const address = new AddressGenerator().generate();
    const releaseOrder = checkoutMock.holdResponses();
    await checkoutPage.goto();
    await checkoutPage.expectToShowCart(lines);
    await checkoutPage.fillAddress(address);

    await checkoutPage.placeOrder();
    await checkoutPage.expectProcessing();
    await checkoutPage.forcePlaceOrder();
    await checkoutPage.expectProcessing();
    await checkoutMock.expectReceivedOrdersToStay(
      1,
      NO_MORE_REQUESTS_WINDOW_MS,
    );
    releaseOrder();

    await paymentPage.expectToShowOrder(await checkoutMock.waitForOrder());
    await checkoutMock.expectPlacedOrder(address);
    await checkoutMock.expectAttemptsToShareIdempotencyKey(1);
  });

  test('empty submit shows every required error and sends nothing', {
    tag: '@negative',
  }, async ({
    checkoutPage,
    fakeProductSearchMock,
    cartMock,
    checkoutMock,
  }) => {
    const lines = seedCart(fakeProductSearchMock, cartMock);
    await checkoutPage.goto();
    await checkoutPage.expectToShowCart(lines);

    await checkoutPage.placeOrder();

    await checkoutPage.expectValidationErrors({
      required: ['street', 'city', 'state', 'zipCode', 'country'],
    });
    await checkoutMock.expectReceivedOrdersToStay(
      0,
      NO_MORE_REQUESTS_WINDOW_MS,
    );
  });

  test('a blank street and a malformed ZIP are rejected until corrected', {
    tag: '@negative',
  }, async ({
    checkoutPage,
    fakeProductSearchMock,
    cartMock,
    checkoutMock,
  }) => {
    const lines = seedCart(fakeProductSearchMock, cartMock);
    const address = new AddressGenerator().generate();
    await checkoutPage.goto();
    await checkoutPage.expectToShowCart(lines);

    await checkoutPage.fillAddress({
      ...address,
      street: '   ',
      zipCode: 'ABC',
    });
    await checkoutPage.placeOrder();

    await checkoutPage.expectValidationErrors({
      required: ['street'],
      invalidZip: true,
    });
    await checkoutPage.fillAddress({
      street: address.street,
      zipCode: address.zipCode,
    });
    await checkoutPage.expectValidationErrors({});
    await checkoutMock.expectReceivedOrdersToStay(
      0,
      NO_MORE_REQUESTS_WINDOW_MS,
    );
  });

  test('back to cart leads to the cart page', async ({
    checkoutPage,
    cartPage,
    fakeProductSearchMock,
    cartMock,
  }) => {
    const lines = seedCart(fakeProductSearchMock, cartMock);
    await checkoutPage.goto();
    await checkoutPage.expectToShowCart(lines);

    await checkoutPage.backToCart();

    await cartPage.expectToBeOpen();
    await cartPage.expectItems(lines);
  });
});
