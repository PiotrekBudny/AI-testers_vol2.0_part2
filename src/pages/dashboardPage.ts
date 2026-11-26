import { expect, type Locator, type Page } from '@playwright/test';
import type { Locators } from '@/types/locators';
import { BasePage } from './basePage';

type Feature = 'products' | 'profile' | 'llm' | 'traffic' | 'qr' | 'email';

export class DashboardPage extends BasePage {
  readonly url = '/';
  readonly title = 'Home – Awesome Testing';

  readonly root: Locator;
  readonly userEmail: Locator;

  readonly headings: Locators<
    'welcome' | 'features' | 'ai' | 'monitoring' | 'utilities'
  >;
  readonly features: Locators<Feature>;
  readonly buttons: Locators<Feature>;

  constructor(page: Page) {
    super(page);

    this.root = page.getByTestId('home-page');
    this.userEmail = page.getByTestId('home-user-email');

    this.headings = {
      welcome: page.getByTestId('home-welcome-title'),
      features: page.getByTestId('home-features-title'),
      ai: page.getByTestId('home-ai-title'),
      monitoring: page.getByTestId('home-monitoring-title'),
      utilities: page.getByTestId('home-utilities-title'),
    };

    this.features = {
      products: page.getByTestId('home-feature-products'),
      profile: page.getByTestId('home-feature-profile'),
      llm: page.getByTestId('home-feature-llm'),
      traffic: page.getByTestId('home-feature-traffic'),
      qr: page.getByTestId('home-feature-qr'),
      email: page.getByTestId('home-feature-email'),
    };

    this.buttons = {
      products: page.getByTestId('home-products-button'),
      profile: page.getByTestId('home-profile-button'),
      llm: page.getByTestId('home-llm-button'),
      traffic: page.getByTestId('home-traffic-button'),
      qr: page.getByTestId('home-qr-button'),
      email: page.getByTestId('home-email-button'),
    };
  }

  async expectToWelcome(displayName: string): Promise<void> {
    const [firstName] = displayName.split(' ');
    await expect(this.root).toBeVisible();
    await expect(this.headings.welcome).toHaveText(`Welcome, ${firstName}!`);
    await this.navigation.expectLoggedInAs(displayName);
  }
}
