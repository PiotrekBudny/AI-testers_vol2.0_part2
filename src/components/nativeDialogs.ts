import { type Dialog, expect, type Page } from '@playwright/test';

export type ConfirmAnswer = 'accept' | 'dismiss';

export class NativeDialogs {
  readonly shown: string[] = [];
  readonly failedAnswers: string[] = [];
  private confirmAnswer: ConfirmAnswer = 'dismiss';
  private listening = false;

  constructor(private readonly page: Page) {}

  answerConfirmsWith(answer: ConfirmAnswer): void {
    this.confirmAnswer = answer;
    if (this.listening) {
      return;
    }
    this.listening = true;
    this.page.on('dialog', (dialog) => {
      this.answer(dialog).catch((error: unknown) => {
        this.failedAnswers.push(String(error));
      });
    });
  }

  async expectShown(dialogs: string[]): Promise<void> {
    await expect
      .poll(() => this.shown, { message: 'native dialogs shown' })
      .toEqual(dialogs);
    expect(
      this.failedAnswers,
      'native dialogs that could not be answered',
    ).toEqual([]);
  }

  private async answer(dialog: Dialog): Promise<void> {
    this.shown.push(`${dialog.type()}: ${dialog.message()}`);
    if (dialog.type() === 'confirm' && this.confirmAnswer === 'dismiss') {
      await dialog.dismiss();
      return;
    }
    await dialog.accept();
  }
}
