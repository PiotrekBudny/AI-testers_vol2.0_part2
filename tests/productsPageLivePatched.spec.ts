import { test } from '@/fixtures/test';

test('client sees real products with the first one patched to sold out', async ({
  productsPage,
  livePatchedProductSearchMock,
}) => {
  const patchedName = 'Patched real product';
  await livePatchedProductSearchMock.register((realResponse) => {
    const [first, ...rest] = realResponse.content;
    if (!first) {
      throw new Error('The real search returned no products to patch');
    }
    return {
      ...realResponse,
      content: [{ ...first, name: patchedName, stockQuantity: 0 }, ...rest],
    };
  });

  await productsPage.goto();

  await productsPage.productItems.first().waitFor();
  await livePatchedProductSearchMock.expectServedWithoutErrors(1);
  livePatchedProductSearchMock.expectOnlyFirstProductPatched();
  await productsPage.expectToShowProducts(
    livePatchedProductSearchMock.lastServed().content,
  );
});
