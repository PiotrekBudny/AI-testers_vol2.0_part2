import type { Locator, Page } from '@playwright/test';
import type { Locators } from '../types/locators';

export class NavigationBar {
  readonly root: Locator;
  readonly brandLogo: Locator;

  readonly links: Locators<'brand' | 'login' | 'register' | 'cart' | 'profile'>;

  readonly menuLinks: Locators<
    | 'products'
    | 'wishlist'
    | 'sendEmail'
    | 'qrCode'
    | 'llm'
    | 'trafficMonitor'
    | 'loyalty'
  >;

  readonly selects: Locators<'shopApi' | 'currency'>;
  readonly buttons: Locators<'logout' | 'mobileMenu'>;

  constructor(page: Page) {
    this.root = page.getByTestId('navigation');
    this.brandLogo = this.root.getByTestId('brand-logo');

    this.links = {
      brand: this.root.getByTestId('brand-link'),
      login: this.root.getByTestId('login-link'),
      register: this.root.getByTestId('register-link'),
      cart: this.root.getByTestId('desktop-cart-icon'),
      profile: this.root.getByTestId('username-profile-link'),
    };

    this.menuLinks = {
      products: this.root.getByTestId('desktop-menu-products'),
      wishlist: this.root.getByTestId('desktop-menu-wishlist'),
      sendEmail: this.root.getByTestId('desktop-menu-send-email'),
      qrCode: this.root.getByTestId('desktop-menu-qr-code'),
      llm: this.root.getByTestId('desktop-menu-llm'),
      trafficMonitor: this.root.getByTestId('desktop-menu-traffic-monitor'),
      loyalty: this.root.getByTestId('desktop-menu-loyalty'),
    };

    this.selects = {
      shopApi: this.root.getByTestId('commerce-transport'),
      currency: this.root.getByTestId('currency-selector'),
    };

    this.buttons = {
      logout: this.root.getByTestId('logout-button'),
      mobileMenu: this.root.getByTestId('mobile-menu-toggle'),
    };
  }

  async logout(): Promise<void> {
    await this.buttons.logout.click();
  }
}
