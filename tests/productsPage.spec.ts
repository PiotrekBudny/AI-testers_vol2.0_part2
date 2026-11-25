import { test } from '../src/fixtures/test';
import { ProductGenerator } from '../src/generators/productGenerator';

test('client sees all mocked products on products page', async ({
  productsPage,
  productSearchMock,
}) => {
  productSearchMock.products = new ProductGenerator().generateProducts(12);

  await productsPage.goto();

  await productsPage.expectToShowProducts(productSearchMock.products);
});

test('client sees empty state when search returns no products', async ({
  productsPage,
  productSearchMock,
}) => {
  productSearchMock.products = [];

  await productsPage.goto();

  await productsPage.expectNoProducts();
});

test('product with very long name and description keeps card layout', async ({
  productsPage,
  productSearchMock,
}) => {
  const longName =
    'Ultra Premium Noise Cancelling Wireless Over Ear Headphones With Extended Battery Life Spatial Audio And Studio Grade Drivers Limited Collector Edition';
  const longDescription =
    'This product description is intentionally very long to check how the card handles overflowing text. '.repeat(
      20,
    );
  const unbrokenText = 'Supercalifragilisticexpialidocious'.repeat(5);
  productSearchMock.products = new ProductGenerator().generateProducts(3);
  productSearchMock.updateProduct(3, {
    name: longName,
    description: longDescription.trim(),
  });
  productSearchMock.updateProduct(2, {
    name: unbrokenText,
    description: unbrokenText.repeat(3),
  });

  await productsPage.goto();

  await productsPage.expectToShowProducts(productSearchMock.products);
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
