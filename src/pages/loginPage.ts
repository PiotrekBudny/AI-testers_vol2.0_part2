import type { Locator, Page } from '@playwright/test';
import type { User } from '../config/users';
import type { Locators } from '../types/locators';
import { BasePage } from './basePage';

export class LoginPage extends BasePage {
  readonly url = '/login';

  readonly form: Locator;
  readonly texts: Locators<'title' | 'subtitle' | 'playgroundNotice'>;
  readonly inputs: Locators<'username' | 'password'>;
  readonly errors: Locators<'username' | 'password'>;
  readonly buttons: Locators<'signIn' | 'forgotPassword' | 'register'>;

  constructor(page: Page) {
    super(page);

    this.form = page.getByTestId('login-form');

    this.texts = {
      title: page.getByTestId('login-title'),
      subtitle: page.getByTestId('login-subtitle'),
      playgroundNotice: page.getByTestId('login-playground-notice'),
    };

    this.inputs = {
      username: page.getByTestId('login-username-input'),
      password: page.getByTestId('login-password-input'),
    };

    this.errors = {
      username: page.getByTestId('login-username-error'),
      password: page.getByTestId('login-password-error'),
    };

    this.buttons = {
      signIn: page.getByTestId('login-submit-button'),
      forgotPassword: page.getByTestId('login-forgot-link'),
      register: page.getByTestId('login-register-link'),
    };
  }

  async login(username: string, password: string): Promise<void> {
    await this.inputs.username.fill(username);
    await this.inputs.password.fill(password);
    await this.buttons.signIn.click();
  }

  async loginAs(user: User): Promise<void> {
    await this.login(user.username, user.password);
  }
}
