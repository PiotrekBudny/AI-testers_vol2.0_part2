import { test } from '../src/fixtures/test';
import { ProductGenerator } from '../src/generators/productGenerator';

test('client sees all mocked products on products page', async ({
  productsPage,
  fakeProductSearchMock,
}) => {
  fakeProductSearchMock.products = new ProductGenerator().generateProducts(12);

  await productsPage.goto();

  await productsPage.expectToShowProducts(fakeProductSearchMock.products);
});

test('client sees empty state when search returns no products', async ({
  productsPage,
  fakeProductSearchMock,
}) => {
  fakeProductSearchMock.products = [];

  await productsPage.goto();

  await productsPage.expectNoProducts();
});

test('product with very long name and description keeps card layout', async ({
  productsPage,
  fakeProductSearchMock,
}) => {
  const longName =
    'Ultra Premium Noise Cancelling Wireless Over Ear Headphones With Extended Battery Life Spatial Audio And Studio Grade Drivers Limited Collector Edition';
  const longDescription =
    'This product description is intentionally very long to check how the card handles overflowing text. '.repeat(
      20,
    );
  const unbrokenText = 'Supercalifragilisticexpialidocious'.repeat(5);
  fakeProductSearchMock.products = new ProductGenerator().generateProducts(3);
  fakeProductSearchMock.updateProduct(3, {
    name: longName,
    description: longDescription.trim(),
  });
  fakeProductSearchMock.updateProduct(2, {
    name: unbrokenText,
    description: unbrokenText.repeat(3),
  });

  await productsPage.goto();

  await productsPage.expectToShowProducts(fakeProductSearchMock.products);
  const regularCard = productsPage.productAt(2);
  for (const longCard of [
    productsPage.productAt(0),
    productsPage.productAt(1),
  ]) {
    await longCard.expectLongTextsTruncated();
    await longCard.expectNoHorizontalOverflow();
    await longCard.expectSameSizeAs(regularCard);
  }
});

test('out of stock product cannot be added to cart while neighbours can', async ({
  productsPage,
  fakeProductSearchMock,
  cartItemsMock,
}) => {
  fakeProductSearchMock.products = new ProductGenerator().generateProducts(3, {
    stockQuantity: 25,
  });
  fakeProductSearchMock.updateProduct(2, { stockQuantity: 0 });
  const [available] = fakeProductSearchMock.products;
  if (!available) {
    throw new Error('Expected a generated product before the sold out one');
  }

  await productsPage.goto();

  await productsPage.expectToShowProducts(fakeProductSearchMock.products);
  await productsPage.expectInStockCount(2);

  await productsPage.productAt(1).forceAddToCart();
  await productsPage.productAt(0).addToCart(2);

  await productsPage.toast.expectToShow(
    'Added to cart',
    `2 × ${available.name} added to your cart`,
  );
  cartItemsMock.expectAddedItems([{ productId: available.id, quantity: 2 }]);
});
