import { expect, test } from '../src/fixtures/test';

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

  await expect(productsPage.productItems.first()).toBeVisible();
  expect(livePatchedProductSearchMock.errors).toEqual([]);
  expect(livePatchedProductSearchMock.servedResponses).toHaveLength(1);
  const [real] = livePatchedProductSearchMock.realResponses;
  const served = livePatchedProductSearchMock.lastServed();
  await productsPage.expectToShowProducts(served.content);
  await expect(productsPage.productAt(0).texts.name).toHaveText(patchedName);
  expect(real?.content[0]?.name).not.toBe(patchedName);
  expect(served.content.slice(1)).toEqual(real?.content.slice(1));
});
