import { getUser } from '../src/config/users';
import { ProductCategory } from '../src/enums/productCategory';
import { test } from '../src/fixtures/test';
import { ProductGenerator } from '../src/generators/productGenerator';

test('client sees mocked product after navigating from dashboard to products', async ({
  loginPage,
  dashboardPage,
  productsPage,
  productSearchMock,
}) => {
  productSearchMock.products = new ProductGenerator(42).generateProducts(5);
  const mocked = productSearchMock.updateProduct(5, {
    name: 'Mocked Bestseller',
    description: 'Mocked description of the bestseller',
    price: 49.99,
    category: ProductCategory.Books,
    imageUrl: '/images/cleancode.png',
    stockQuantity: 10,
    averageRating: 4.5,
    reviewCount: 2,
  });

  await loginPage.goto();
  await loginPage.loginAs(getUser('client'));
  await dashboardPage.buttons.products.click();

  await productsPage.product(mocked.name).expectToShow(mocked);
});
