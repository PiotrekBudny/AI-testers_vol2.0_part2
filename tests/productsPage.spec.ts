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
