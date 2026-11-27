import { expect, type Locator, type Page } from '@playwright/test';
import type { RegisterRequest } from '@/models/auth';
import type { FieldErrors } from '@/models/fieldErrors';
import type { Locators } from '@/types/locators';
import { BasePage } from './basePage';

type RegisterField = keyof RegisterRequest;

type RegisterFieldErrors = FieldErrors<RegisterField>;

const registerFields: RegisterField[] = [
  'username',
  'email',
  'password',
  'firstName',
  'lastName',
];

const requiredMessages: Record<RegisterField, string> = {
  username: 'Username is required',
  email: 'Email is required',
  password: 'Password is required',
  firstName: 'First name is required',
  lastName: 'Last name is required',
};

const SUBMIT_TEXT = 'Create account';
const SUBMIT_PENDING_TEXT = 'Creating account...';

export class RegisterPage extends BasePage {
  readonly url = '/register';
  readonly title = 'Create account – Awesome Testing';

  readonly inputs: Locators<RegisterField>;
  readonly errors: Locators<RegisterField | 'submit'>;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);

    this.inputs = {
      username: page.getByTestId('register-username-input'),
      email: page.getByTestId('register-email-input'),
      password: page.getByTestId('register-password-input'),
      firstName: page.getByTestId('register-firstname-input'),
      lastName: page.getByTestId('register-lastname-input'),
    };

    this.errors = {
      username: page.getByTestId('register-username-error'),
      email: page.getByTestId('register-email-error'),
      password: page.getByTestId('register-password-error'),
      firstName: page.getByTestId('register-firstname-error'),
      lastName: page.getByTestId('register-lastname-error'),
      submit: page.getByTestId('register-submit-error'),
    };

    this.submitButton = page.getByTestId('register-submit-button');
  }

  async fill(request: RegisterRequest): Promise<void> {
    for (const field of registerFields) {
      await this.inputs[field].fill(request[field]);
    }
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async forceSubmit(): Promise<void> {
    await this.submitButton.click({ force: true });
  }

  async register(request: RegisterRequest): Promise<void> {
    await this.fill(request);
    await this.submit();
  }

  async expectFieldErrors(errors: RegisterFieldErrors): Promise<void> {
    for (const field of registerFields) {
      const message = errors[field];
      if (message === undefined) {
        await expect(this.errors[field]).toBeHidden();
        await expect(this.inputs[field]).not.toHaveAttribute(
          'aria-invalid',
          'true',
        );
      } else {
        await expect(this.errors[field]).toHaveText(message);
        await expect(this.inputs[field]).toHaveAttribute(
          'aria-invalid',
          'true',
        );
      }
    }
  }

  async expectAllFieldsRequired(): Promise<void> {
    await this.expectFieldErrors(requiredMessages);
  }

  async expectSubmitPending(): Promise<void> {
    await expect(this.submitButton).toHaveText(SUBMIT_PENDING_TEXT);
    await expect(this.submitButton).toBeDisabled();
  }

  async expectFilledWith(request: RegisterRequest): Promise<void> {
    for (const field of registerFields) {
      await expect(this.inputs[field]).toHaveValue(request[field]);
    }
  }

  async expectReadyToSubmit(): Promise<void> {
    await expect(this.submitButton).toHaveText(SUBMIT_TEXT);
    await expect(this.submitButton).toBeEnabled();
  }

  async expectUsernameTakenError(request: RegisterRequest): Promise<void> {
    await this.toast.expectToShow('Error', 'Username already exists');
    await this.expectToBeOpen();
    await this.expectFilledWith(request);
    await this.expectFieldErrors({});
    await expect(this.errors.submit).toBeHidden();
    await this.expectReadyToSubmit();
  }
}
