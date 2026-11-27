import { ProductSearchTraffic } from '@/assertions/productSearchTraffic';
import { SignInTraffic } from '@/assertions/signInTraffic';
import { randomDetailsProductId } from '@/config/mockIds';
import { getUser } from '@/config/users';
import { ProductGenerator } from '@/generators/productGenerator';
import { AdminCatalogMock } from '@/mocks/adminCatalogMock';
import { AdminInventoryMock } from '@/mocks/adminInventoryMock';
import { AdminOrdersMock } from '@/mocks/adminOrdersMock';
import { ApiErrorMock } from '@/mocks/apiErrorMock';
import { CartMock } from '@/mocks/cartMock';
import { CheckoutMock } from '@/mocks/checkoutMock';
import { FakeProductDetailsMock } from '@/mocks/fakeProductDetailsMock';
import { FakeProductSearchMock } from '@/mocks/fakeProductSearchMock';
import { HarReplayMock } from '@/mocks/harReplayMock';
import { LivePatchedProductDetailsMock } from '@/mocks/livePatchedProductDetailsMock';
import { LivePatchedProductSearchMock } from '@/mocks/livePatchedProductSearchMock';
import { NetworkErrorMock } from '@/mocks/networkErrorMock';
import { SignupMock } from '@/mocks/signupMock';
import { EndpointOwners } from '@/mocks/support/endpointOwners';
import type { CartLine } from '@/models/cart';
import type { Product } from '@/models/product';
import { requireBaseURL, sessionTest } from './session';

const SEARCH_PRODUCT_COUNT = 8;
const TWO_LINE_CART_QUANTITIES = [2, 1];
const TWO_LINE_CART_STOCK = 10;

type TwoLineCart = { products: Product[]; lines: CartLine[]; first: Product };

type Mocks = {
  endpointOwners: EndpointOwners;
  signInTraffic: SignInTraffic;
  productSearchTraffic: ProductSearchTraffic;
  fakeProductSearchMock: FakeProductSearchMock;
  fakeProductDetailsMock: FakeProductDetailsMock;
  cartMock: CartMock;
  twoLineCart: TwoLineCart;
  checkoutMock: CheckoutMock;
  signupMock: SignupMock;
  adminCatalogMock: AdminCatalogMock;
  adminOrdersMock: AdminOrdersMock;
  adminInventoryMock: AdminInventoryMock;
  apiErrorMock: ApiErrorMock;
  networkErrorMock: NetworkErrorMock;
  harReplayMock: HarReplayMock;
  livePatchedProductSearchMock: LivePatchedProductSearchMock;
  livePatchedProductDetailsMock: LivePatchedProductDetailsMock;
};

export const mocksTest = sessionTest.extend<Mocks>({
  endpointOwners: async ({ userRole: _userRole }, use) => {
    await use(new EndpointOwners());
  },
  signInTraffic: async ({ page }, use) => {
    await use(new SignInTraffic(page));
  },
  productSearchTraffic: async ({ page }, use) => {
    await use(new ProductSearchTraffic(page));
  },
  fakeProductSearchMock: async ({ page, endpointOwners }, use) => {
    endpointOwners.claim('fakeProductSearchMock', ['productSearch']);
    const mock = new FakeProductSearchMock(
      page,
      new ProductGenerator().generateProducts(SEARCH_PRODUCT_COUNT),
    );
    await mock.register();
    await use(mock);
  },
  fakeProductDetailsMock: async ({ page, endpointOwners }, use) => {
    endpointOwners.claim('fakeProductDetailsMock', [
      'productDetails',
      'productReviews',
    ]);
    const mock = new FakeProductDetailsMock(
      page,
      new ProductGenerator().generateProduct({
        id: randomDetailsProductId(),
        stockQuantity: 5 + Math.floor(Math.random() * 46),
      }),
    );
    await mock.register();
    await use(mock);
  },
  cartMock: async (
    {
      page,
      userRole,
      endpointOwners,
      fakeProductSearchMock,
      fakeProductDetailsMock,
    },
    use,
  ) => {
    endpointOwners.claim('cartMock', ['cart', 'cartItems', 'cartItem']);
    fakeProductDetailsMock.alsoServe(() => fakeProductSearchMock.products);
    const mock = new CartMock(page, getUser(userRole).username, () => [
      ...fakeProductSearchMock.products,
      fakeProductDetailsMock.product,
    ]);
    await mock.register();
    await use(mock);
    mock.releaseHeldResponses();
  },
  twoLineCart: async ({ fakeProductSearchMock, cartMock }, use) => {
    const cart = new ProductGenerator().generateCart(TWO_LINE_CART_QUANTITIES, {
      stockQuantity: TWO_LINE_CART_STOCK,
    });
    fakeProductSearchMock.products = cart.products;
    cartMock.seedLines(cart.lines);
    await use(cart);
  },
  checkoutMock: async ({ page, userRole, endpointOwners, cartMock }, use) => {
    endpointOwners.claim('checkoutMock', [
      'taxPreview',
      'orders',
      'order',
      'orderPayments',
    ]);
    const mock = new CheckoutMock(page, getUser(userRole).username, cartMock);
    await mock.register();
    await use(mock);
    mock.releaseHeldResponses();
  },
  signupMock: async ({ page, endpointOwners }, use) => {
    endpointOwners.claim('signupMock', ['signUp']);
    const mock = new SignupMock(page);
    await mock.register();
    await use(mock);
    mock.releaseHeldResponses();
  },
  adminCatalogMock: async ({ page, endpointOwners }, use) => {
    endpointOwners.claim('adminCatalogMock', ['productList', 'productDetails']);
    const mock = new AdminCatalogMock(page);
    await mock.register();
    await use(mock);
    mock.releaseHeldResponses();
  },
  adminOrdersMock: async ({ page, endpointOwners }, use) => {
    endpointOwners.claim('adminOrdersMock', [
      'adminOrders',
      'order',
      'orderPayments',
      'orderSubresources',
      'orderStatus',
      'orderCancel',
    ]);
    const mock = new AdminOrdersMock(page);
    await mock.register();
    await use(mock);
    mock.releaseHeldResponses();
  },
  adminInventoryMock: async ({ page, endpointOwners }, use) => {
    endpointOwners.claim('adminInventoryMock', [
      'inventoryList',
      'inventoryItem',
      'inventoryMovements',
      'inventoryAdjustments',
    ]);
    const mock = new AdminInventoryMock(page);
    await mock.register();
    await use(mock);
    mock.releaseHeldResponses();
  },
  apiErrorMock: async ({ page }, use) => {
    await use(new ApiErrorMock(page));
  },
  networkErrorMock: async ({ page }, use) => {
    await use(new NetworkErrorMock(page));
  },
  harReplayMock: async (
    { page, baseURL, userRole, endpointOwners },
    use,
    testInfo,
  ) => {
    await use(
      new HarReplayMock(
        page,
        testInfo.outputPath('har-work'),
        requireBaseURL(baseURL),
        userRole,
        endpointOwners,
      ),
    );
  },
  livePatchedProductSearchMock: async ({ page, endpointOwners }, use) => {
    endpointOwners.claim('livePatchedProductSearchMock', ['productSearch']);
    await use(new LivePatchedProductSearchMock(page));
  },
  livePatchedProductDetailsMock: async ({ page, endpointOwners }, use) => {
    endpointOwners.claim('livePatchedProductDetailsMock', ['productDetails']);
    await use(new LivePatchedProductDetailsMock(page));
  },
});
