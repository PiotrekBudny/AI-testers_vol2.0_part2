async (page) => {
  page.__blocked = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      await route.fallback();
      return;
    }
    page.__blocked.push({
      method: request.method(),
      url: request.url(),
      body: request.postData(),
    });
    await route.fulfill({
      status: 418,
      json: { message: 'Blocked by the MCP safety net' },
    });
  });
  return 'Safety net on: non-GET /api/** calls get 418 and are logged in page.__blocked';
}
