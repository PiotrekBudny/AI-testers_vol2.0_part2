export const apiRoutes = {
  productSearch: '**/api/v1/products/search**',
  productDetails: /\/api\/v1\/products\/\d+\/?(\?.*)?$/,
  productReviews: /\/api\/v1\/products\/\d+\/reviews(\/|\?|$)/,
  cartItems: '**/api/v1/cart/items',
  currentUser: '**/api/v1/users/me',
  tokenRefresh: '**/api/v1/users/refresh',
  logout: '**/api/v1/users/logout',
} as const;

export type ApiEndpoint = keyof typeof apiRoutes;
