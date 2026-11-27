export const apiPaths = {
  signIn: '/api/v1/users/signin',
  productSearch: '/api/v1/products/search',
  cartItems: '/api/v1/cart/items',
  currentUser: '/api/v1/users/me',
  tokenRefresh: '/api/v1/users/refresh',
  logout: '/api/v1/users/logout',
  orders: '/api/v1/orders',
  taxPreview: '/api/v1/cart/tax-preview',
} as const;

export const apiRoutes = {
  productSearch: `**${apiPaths.productSearch}**`,
  productDetails: /\/api\/v1\/products\/\d+\/?(\?.*)?$/,
  productReviews: /\/api\/v1\/products\/\d+\/reviews(\/|\?|$)/,
  cart: /\/api\/v1\/cart\/?(\?.*)?$/,
  cartItems: `**${apiPaths.cartItems}`,
  cartItem: /\/api\/v1\/cart\/items\/\d+\/?(\?.*)?$/,
  currentUser: `**${apiPaths.currentUser}`,
  tokenRefresh: `**${apiPaths.tokenRefresh}`,
  logout: `**${apiPaths.logout}`,
  orders: /\/api\/v1\/orders\/?(\?.*)?$/,
  order: /\/api\/v1\/orders\/\d+\/?(\?.*)?$/,
  orderPayments: /\/api\/v1\/orders\/\d+\/payments\/?(\?.*)?$/,
  taxPreview: `**${apiPaths.taxPreview}**`,
} as const;

export type ApiEndpoint = keyof typeof apiRoutes;
