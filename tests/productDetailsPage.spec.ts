import { NO_MORE_REQUESTS_WINDOW_MS } from '@/config/timing';
import { test } from '@/fixtures/test';

const UNKNOWN_PRODUCT_ID = 98_765;

test.describe('Product details page', {
  tag: ['@product-details', '@mocked'],
}, () => {
  test('client sees product details served by the mock', async ({
    productDetailsPage,
    fakeProductDetailsMock,
  }) => {
    await productDetailsPage.open(fakeProductDetailsMock.product);

    await productDetailsPage.expectToShowProduct(
      fakeProductDetailsMock.product,
    );
  });

  test('client sees not found page when product returns 404', {
    tag: '@negative',
  }, async ({
    productDetailsPage,
    productsPage,
    fakeProductSearchMock,
    apiErrorMock,
  }) => {
    await apiErrorMock.respondWithError('productDetails', 404);

    await productDetailsPage.openById(UNKNOWN_PRODUCT_ID);

    await productDetailsPage.expectNotFound();
    await apiErrorMock.expectRequestCountToStay(
      'productDetails',
      1,
      NO_MORE_REQUESTS_WINDOW_MS,
    );

    await productDetailsPage.backToProducts();

    await productsPage.expectToBeOpen();
    await productsPage.expectToShowProducts(fakeProductSearchMock.products);
  });

  test('client sees error toast when adding to cart fails with 500', {
    tag: '@negative',
  }, async ({ productDetailsPage, fakeProductDetailsMock, apiErrorMock }) => {
    await apiErrorMock.respondWithError('cartItems', 500);
    await productDetailsPage.open(fakeProductDetailsMock.product);
    await productDetailsPage.increaseQuantity(1);

    await productDetailsPage.addToCart();

    await productDetailsPage.toast.expectToShow(
      'Error',
      'Failed to update cart. Please try again.',
    );
    await productDetailsPage.expectReadyToAdd(2);
    await apiErrorMock.expectRequestCountToStay(
      'cartItems',
      1,
      NO_MORE_REQUESTS_WINDOW_MS,
    );
  });

  test('out of stock product cannot be added to cart', async ({
    productDetailsPage,
    fakeProductDetailsMock,
    cartMock,
  }) => {
    fakeProductDetailsMock.updateProduct({ stockQuantity: 0 });

    await productDetailsPage.open(fakeProductDetailsMock.product);

    await productDetailsPage.expectOutOfStock();

    await productDetailsPage.forceAddToCart();

    await productDetailsPage.expectOutOfStock();
    await cartMock.expectAddedItemsToStay([], NO_MORE_REQUESTS_WINDOW_MS);
  });

  test('repeated clicks while adding to cart send one request', async ({
    productDetailsPage,
    fakeProductDetailsMock,
    cartMock,
  }) => {
    const { product } = fakeProductDetailsMock;
    const releaseCart = cartMock.holdResponses();
    await productDetailsPage.open(product);

    await productDetailsPage.addToCart();
    await productDetailsPage.expectAddingToCart();
    await productDetailsPage.forceAddToCart();
    await productDetailsPage.forceAddToCart();
    releaseCart();

    await productDetailsPage.toast.expectToShow(
      'Added to cart',
      `1 × ${product.name} added to your cart`,
    );
    await productDetailsPage.expectInCart(1);
    await cartMock.expectAddedItemsToStay(
      [{ productId: product.id, quantity: 1 }],
      NO_MORE_REQUESTS_WINDOW_MS,
    );
  });

  test('adding a product already in the cart sets its quantity with PUT', async ({
    productDetailsPage,
    fakeProductDetailsMock,
    cartMock,
  }) => {
    const { product } = fakeProductDetailsMock;
    await productDetailsPage.open(product);

    await productDetailsPage.addToCart();
    await productDetailsPage.expectCartCount(1);
    await productDetailsPage.addToCart();

    await cartMock.expectUpdatedItems([{ productId: product.id, quantity: 1 }]);
    await cartMock.expectAddedItemsToStay(
      [{ productId: product.id, quantity: 1 }],
      NO_MORE_REQUESTS_WINDOW_MS,
    );
    await productDetailsPage.expectInCart(1);
  });
});
