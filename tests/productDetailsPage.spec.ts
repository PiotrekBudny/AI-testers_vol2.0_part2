import { test } from '@/fixtures/test';

const NO_RETRY_WINDOW_MS = 1_500;
const UNKNOWN_PRODUCT_ID = 98_765;

test('client sees product details served by the mock', async ({
  productDetailsPage,
  fakeProductDetailsMock,
}) => {
  await productDetailsPage.open(fakeProductDetailsMock.product);

  await productDetailsPage.expectToShowProduct(fakeProductDetailsMock.product);
});

test('client sees not found page when product returns 404', async ({
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
    NO_RETRY_WINDOW_MS,
  );

  await productDetailsPage.backToProducts();

  await productsPage.expectToBeOpen();
  await productsPage.expectToShowProducts(fakeProductSearchMock.products);
});

test('client sees error toast when adding to cart fails with 500', async ({
  productDetailsPage,
  fakeProductDetailsMock,
  apiErrorMock,
}) => {
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
    NO_RETRY_WINDOW_MS,
  );
});

test('out of stock product cannot be added to cart', async ({
  productDetailsPage,
  fakeProductDetailsMock,
  cartItemsMock,
}) => {
  fakeProductDetailsMock.updateProduct({ stockQuantity: 0 });

  await productDetailsPage.open(fakeProductDetailsMock.product);

  await productDetailsPage.expectOutOfStock();

  await productDetailsPage.forceAddToCart();

  await productDetailsPage.expectOutOfStock();
  await cartItemsMock.expectAddedItemsToStay([], NO_RETRY_WINDOW_MS);
});

test('repeated clicks while adding to cart send one request', async ({
  productDetailsPage,
  fakeProductDetailsMock,
  cartItemsMock,
}) => {
  const { product } = fakeProductDetailsMock;
  const releaseCart = cartItemsMock.holdResponses();
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
  await productDetailsPage.expectReadyToAdd(1);
  await cartItemsMock.expectAddedItemsToStay(
    [{ productId: product.id, quantity: 1 }],
    NO_RETRY_WINDOW_MS,
  );
});

test('each click after the previous add completes adds again', async ({
  productDetailsPage,
  fakeProductDetailsMock,
  cartItemsMock,
}) => {
  const { product } = fakeProductDetailsMock;
  await productDetailsPage.open(product);

  await productDetailsPage.addToCart();
  await productDetailsPage.toast.expectToShow(
    'Added to cart',
    `1 × ${product.name} added to your cart`,
  );
  await productDetailsPage.addToCart();

  await productDetailsPage.expectReadyToAdd(1);
  await cartItemsMock.expectAddedItems([
    { productId: product.id, quantity: 1 },
    { productId: product.id, quantity: 1 },
  ]);
});
