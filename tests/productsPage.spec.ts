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
