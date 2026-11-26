export const apiPaths = {
  signIn: '/api/v1/users/signin',
  productSearch: '/api/v1/products/search',
  cartItems: '/api/v1/cart/items',
  currentUser: '/api/v1/users/me',
  tokenRefresh: '/api/v1/users/refresh',
  logout: '/api/v1/users/logout',
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
} as const;

export type ApiEndpoint = keyof typeof apiRoutes;
