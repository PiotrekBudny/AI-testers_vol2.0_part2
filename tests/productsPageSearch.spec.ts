import { test } from '@/fixtures/test';

test('client finds a product by its name', async ({
  productsPage,
  fakeProductSearchMock,
}) => {
  const target = fakeProductSearchMock.updateProduct(5, {
    name: 'Zephyr Quantum Speaker',
  });

  await productsPage.goto();
  await productsPage.expectToShowProducts(fakeProductSearchMock.products);

  await productsPage.search('zephyr quantum');

  await productsPage.expectToShowProducts([target]);
  await productsPage.expectSearchFor('zephyr quantum');
  await fakeProductSearchMock.expectLastSearchedFor('zephyr quantum');
});

test('client finds a product by a word from its description', async ({
  productsPage,
  fakeProductSearchMock,
}) => {
  const target = fakeProductSearchMock.updateProduct(3, {
    description: 'Projects a holographic display above any desk surface.',
  });

  await productsPage.goto();
  await productsPage.expectToShowProducts(fakeProductSearchMock.products);

  await productsPage.search('Holographic');

  await productsPage.expectToShowProducts([target]);
  await productsPage.expectSearchFor('Holographic');
  await fakeProductSearchMock.expectLastSearchedFor('Holographic');
});

test('client sees empty state when search matches nothing', async ({
  productsPage,
  fakeProductSearchMock,
}) => {
  await productsPage.goto();
  await productsPage.expectToShowProducts(fakeProductSearchMock.products);

  await productsPage.search('no-such-product-xyz');

  await productsPage.expectNoSearchResults();
  await productsPage.expectSearchFor('no-such-product-xyz');
});

test('client clears the search with the clear button', async ({
  productsPage,
  fakeProductSearchMock,
}) => {
  const target = fakeProductSearchMock.updateProduct(7, {
    name: 'Zephyr Quantum Speaker',
  });
  await productsPage.goto();
  await productsPage.search('zephyr');
  await productsPage.expectToShowProducts([target]);

  await productsPage.clearSearch();

  await productsPage.expectToShowProducts(fakeProductSearchMock.products);
  await productsPage.expectSearchCleared();
  await fakeProductSearchMock.expectLastSearchedFor(null);
});
