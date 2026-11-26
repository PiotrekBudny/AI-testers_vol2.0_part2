import { expect, type Locator, type Page } from '@playwright/test';
import type { User } from '@/config/users';
import type { Locators } from '@/types/locators';
import { BasePage } from './basePage';

type LoginField = 'username' | 'password';

const requiredMessages: Record<LoginField, string> = {
  username: 'Username is required',
  password: 'Password is required',
};

export class LoginPage extends BasePage {
  readonly url = '/login';
  readonly title = 'Sign in – Awesome Testing';

  readonly form: Locator;
  readonly heading: Locator;
  readonly inputs: Locators<LoginField>;
  readonly errors: Locators<LoginField>;
  readonly buttons: Locators<'signIn' | 'forgotPassword' | 'register'>;

  constructor(page: Page) {
    super(page);

    this.form = page.getByTestId('login-form');

    this.heading = page.getByTestId('login-title');

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

  async expectEmptyForm(): Promise<void> {
    await expect(this.heading).toHaveText('Sign in to your account');
    await expect(this.inputs.username).toBeEmpty();
    await expect(this.inputs.password).toBeEmpty();
    await expect(this.inputs.password).toHaveAttribute('type', 'password');
    await this.expectRequiredErrors([]);
    await expect(this.buttons.signIn).toBeEnabled();
  }

  async expectRequiredErrors(fields: LoginField[]): Promise<void> {
    for (const field of Object.keys(requiredMessages) as LoginField[]) {
      if (fields.includes(field)) {
        await expect(this.errors[field]).toHaveText(requiredMessages[field]);
        await expect(this.inputs[field]).toHaveAttribute(
          'aria-invalid',
          'true',
        );
      } else {
        await expect(this.errors[field]).toBeHidden();
      }
    }
  }

  async expectInvalidCredentialsError(): Promise<void> {
    await this.toast.expectToShow('Error', 'Invalid username/password');
  }

  async expectToShowLoggedOutForm(): Promise<void> {
    await this.expectToBeOpen();
    await expect(this.form).toBeVisible();
    await expect(this.buttons.signIn).toBeEnabled();
    await this.navigation.expectLoggedOut();
  }
}
