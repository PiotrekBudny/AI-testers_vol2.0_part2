export const apiRoutes = {
  productSearch: '**/api/v1/products/search**',
  productDetails: /\/api\/v1\/products\/\d+\/?(\?.*)?$/,
  productReviews: /\/api\/v1\/products\/\d+\/reviews(\/|\?|$)/,
  cart: /\/api\/v1\/cart\/?(\?.*)?$/,
  cartItems: '**/api/v1/cart/items',
  cartItem: /\/api\/v1\/cart\/items\/\d+\/?(\?.*)?$/,
  currentUser: '**/api/v1/users/me',
  tokenRefresh: '**/api/v1/users/refresh',
  logout: '**/api/v1/users/logout',
} as const;

export type ApiEndpoint = keyof typeof apiRoutes;
