import { test } from '@/fixtures/test';
import { ProductGenerator } from '@/generators/productGenerator';

function catalogue(stockQuantity: number) {
  const products = new ProductGenerator().generateProducts(3, {
    stockQuantity,
  });
  const [first, second] = products;
  if (!first || !second) {
    throw new Error('Expected generated products');
  }
  return { products, first, second };
}

test('client adds a product, changes its quantity and removes it', async ({
  productDetailsPage,
  cartPage,
  fakeProductDetailsMock,
  cartMock,
}) => {
  const { product } = fakeProductDetailsMock;
  await productDetailsPage.open(product);
  await productDetailsPage.expectCartCount(0);

  await productDetailsPage.addToCart();
  await productDetailsPage.expectCartCount(1);
  await productDetailsPage.increaseQuantity(1);
  await productDetailsPage.addToCart();

  await productDetailsPage.expectCartCount(2);
  await cartMock.expectAddedItems([{ productId: product.id, quantity: 1 }]);
  await cartMock.expectUpdatedItems([{ productId: product.id, quantity: 2 }]);
  await cartMock.expectCartItems([{ productId: product.id, quantity: 2 }]);

  await cartPage.goto();
  await cartPage.expectItems([{ product, quantity: 2 }]);

  await cartPage.item(product.id).setQuantity(2, 3);

  await cartPage.toast.expectToShow(
    'Cart updated',
    `${product.name} quantity set to 3`,
  );
  await cartPage.expectItems([{ product, quantity: 3 }]);
  await cartMock.expectCartItems([{ productId: product.id, quantity: 3 }]);

  await cartPage.item(product.id).remove();

  await cartPage.toast.expectToShow(
    'Removed from cart',
    `${product.name} has been removed from your cart`,
  );
  await cartPage.expectEmpty();
  await cartMock.expectCartItems([]);
});

test('client sees a cart seeded in the mock on every page', async ({
  productDetailsPage,
  cartPage,
  fakeProductDetailsMock,
  cartMock,
}) => {
  const { product } = fakeProductDetailsMock;
  cartMock.seed([{ productId: product.id, quantity: 4 }]);

  await productDetailsPage.open(product);
  await productDetailsPage.expectInCart(4);

  await cartPage.goto();

  await cartPage.expectItems([{ product, quantity: 4 }]);
});

test('every test starts with an empty cart', async ({ cartPage, cartMock }) => {
  await cartPage.goto();

  await cartPage.expectEmpty();
  await cartMock.expectCartItems([]);
});

test('client adds two products from the list and sees both in the cart', async ({
  productsPage,
  cartPage,
  fakeProductSearchMock,
  cartMock,
}) => {
  const { products, first, second } = catalogue(10);
  fakeProductSearchMock.products = products;
  await productsPage.goto();

  await productsPage.productAt(0).addToCart(2);
  await productsPage.expectCartCount(2);
  await productsPage.productAt(1).addToCart(1);

  await productsPage.expectCartCount(3);
  await cartMock.expectCartItems([
    { productId: first.id, quantity: 2 },
    { productId: second.id, quantity: 1 },
  ]);

  await cartPage.goto();

  await cartPage.expectItems([
    { product: first, quantity: 2 },
    { product: second, quantity: 1 },
  ]);
});

test('cart quantity changes are saved only after Update', async ({
  cartPage,
  fakeProductSearchMock,
  cartMock,
}) => {
  const { products, first } = catalogue(3);
  fakeProductSearchMock.products = products;
  cartMock.seed([{ productId: first.id, quantity: 2 }]);
  await cartPage.goto();
  const row = cartPage.item(first.id);
  await row.expectSavedQuantity(2);
  await row.expectQuantityLimits({ atMinimum: false, atMaximum: false });

  await row.changeQuantityWithoutSaving(2, 3);

  await row.expectUnsavedQuantity(3);
  await row.expectQuantityLimits({ atMinimum: false, atMaximum: true });
  await cartPage.expectSummary(2, first.price * 2);

  await row.changeQuantityWithoutSaving(3, 2);

  await row.expectSavedQuantity(2);

  await row.changeQuantityWithoutSaving(2, 1);

  await row.expectUnsavedQuantity(1);
  await row.expectQuantityLimits({ atMinimum: true, atMaximum: false });
  await cartMock.expectUpdatedItems([]);

  await row.saveQuantity();

  await row.expectSavedQuantity(1);
  await cartPage.expectItems([{ product: first, quantity: 1 }]);
  await cartMock.expectUpdatedItems([{ productId: first.id, quantity: 1 }]);
});

test('removing one of two products keeps the other', async ({
  cartPage,
  fakeProductSearchMock,
  cartMock,
}) => {
  const { products, first, second } = catalogue(10);
  fakeProductSearchMock.products = products;
  cartMock.seed([
    { productId: first.id, quantity: 1 },
    { productId: second.id, quantity: 3 },
  ]);
  await cartPage.goto();

  await cartPage.item(first.id).remove();

  await cartPage.toast.expectToShow(
    'Removed from cart',
    `${first.name} has been removed from your cart`,
  );
  await cartPage.expectItems([{ product: second, quantity: 3 }]);
  await cartMock.expectCartItems([{ productId: second.id, quantity: 3 }]);
});

test('client clears the cart after confirming', async ({
  cartPage,
  fakeProductSearchMock,
  cartMock,
}) => {
  const { products, first, second } = catalogue(10);
  fakeProductSearchMock.products = products;
  cartMock.seed([
    { productId: first.id, quantity: 1 },
    { productId: second.id, quantity: 2 },
  ]);
  await cartPage.goto();

  await cartPage.clearCart('accept');

  await cartPage.expectClearConfirmationAsked();
  await cartPage.toast.expectToShow(
    'Cart cleared',
    'All items have been removed from your cart',
  );
  await cartPage.expectEmpty();
  await cartMock.expectCartItems([]);
});

test('dismissing the clear cart confirmation keeps the items', async ({
  cartPage,
  fakeProductSearchMock,
  cartMock,
}) => {
  const { products, first, second } = catalogue(10);
  fakeProductSearchMock.products = products;
  const seeded = [
    { productId: first.id, quantity: 1 },
    { productId: second.id, quantity: 2 },
  ];
  cartMock.seed(seeded);
  await cartPage.goto();

  await cartPage.clearCart('dismiss');

  await cartPage.expectClearConfirmationAsked();
  await cartPage.expectItems([
    { product: first, quantity: 1 },
    { product: second, quantity: 2 },
  ]);
  await cartMock.expectCartItems(seeded);
});

test('continue shopping and browse products lead to the products page', async ({
  cartPage,
  productsPage,
  fakeProductSearchMock,
  cartMock,
}) => {
  const { products, first } = catalogue(10);
  fakeProductSearchMock.products = products;
  cartMock.seed([{ productId: first.id, quantity: 1 }]);
  await cartPage.goto();

  await cartPage.continueShopping();

  await productsPage.expectToBeOpen();

  cartMock.seed([]);
  await cartPage.goto();
  await cartPage.expectEmpty();

  await cartPage.browseProducts();

  await productsPage.expectToBeOpen();
});
