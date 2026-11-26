import { NO_MORE_REQUESTS_WINDOW_MS } from '@/config/timing';
import { test } from '@/fixtures/test';
import { ProductGenerator } from '@/generators/productGenerator';

function seededProduct() {
  const { products, first } = new ProductGenerator().generateCatalogue(2, {
    stockQuantity: 10,
  });
  return { products, product: first };
}

test.describe('Cart page API errors', {
  tag: ['@cart', '@mocked', '@negative'],
}, () => {
  test('a failed quantity update shows an error and keeps the saved quantity', async ({
    cartPage,
    fakeProductSearchMock,
    cartMock,
    apiErrorMock,
  }) => {
    const { products, product } = seededProduct();
    fakeProductSearchMock.products = products;
    cartMock.seed([{ productId: product.id, quantity: 2 }]);
    await apiErrorMock.respondWithError('cartItem', 500);
    await cartPage.goto();

    await cartPage.item(product.id).setQuantity(2, 3);

    await cartPage.toast.expectToShow(
      'Error',
      'Failed to update cart. Please try again.',
    );
    await cartPage.item(product.id).expectSavedQuantity(2);
    await cartPage.expectItems([{ product, quantity: 2 }]);
    await cartMock.expectCartItems([{ productId: product.id, quantity: 2 }]);
    await apiErrorMock.expectRequestCountToStay(
      'cartItem',
      1,
      NO_MORE_REQUESTS_WINDOW_MS,
    );
  });

  test('a failed remove shows an error and keeps the item', async ({
    cartPage,
    fakeProductSearchMock,
    cartMock,
    apiErrorMock,
  }) => {
    const { products, product } = seededProduct();
    fakeProductSearchMock.products = products;
    cartMock.seed([{ productId: product.id, quantity: 1 }]);
    await apiErrorMock.respondWithError('cartItem', 500);
    await cartPage.goto();

    await cartPage.item(product.id).remove();

    await cartPage.toast.expectToShow(
      'Error',
      'Failed to remove from cart. Please try again.',
    );
    await cartPage.expectItems([{ product, quantity: 1 }]);
    await cartMock.expectCartItems([{ productId: product.id, quantity: 1 }]);
    await apiErrorMock.expectRequestCountToStay(
      'cartItem',
      1,
      NO_MORE_REQUESTS_WINDOW_MS,
    );
  });

  test('a dropped connection during a quantity update keeps the saved quantity', async ({
    cartPage,
    fakeProductSearchMock,
    cartMock,
    networkErrorMock,
  }) => {
    const { products, product } = seededProduct();
    fakeProductSearchMock.products = products;
    cartMock.seed([{ productId: product.id, quantity: 2 }]);
    await networkErrorMock.abort('cartItem', {
      errorCode: 'internetdisconnected',
    });
    await cartPage.goto();

    await cartPage.item(product.id).setQuantity(2, 3);

    await cartPage.toast.expectToShow(
      'Error',
      'Failed to update cart. Please try again.',
    );
    await cartPage.item(product.id).expectSavedQuantity(2);
    await cartMock.expectCartItems([{ productId: product.id, quantity: 2 }]);
    await networkErrorMock.expectAbortedCountToStay(
      'cartItem',
      1,
      NO_MORE_REQUESTS_WINDOW_MS,
    );
  });
});
