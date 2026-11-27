import { expect, type Locator, type Page } from '@playwright/test';
import { LOAD_ERROR_TIMEOUT_MS } from '@/config/timing';
import type { InventoryAdjustment, InventoryItem } from '@/models/inventory';
import type { Locators } from '@/types/locators';
import { STOCK_STATUS_LABELS } from './inventoryLabels';

type AdjustmentField = 'delta' | 'reason';

type AdjustmentInput = Record<AdjustmentField, string>;

type ShownMovement = Pick<InventoryAdjustment, 'delta' | 'reason'> & {
  id: number;
};

const ADJUSTMENT_ERRORS = {
  conflict:
    'This adjustment conflicts with the current inventory state. Review the quantity and retry the same adjustment if it is still valid.',
  generic: 'Unable to apply this adjustment. Check the values and try again.',
};

function signed(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

export class InventoryInspector {
  readonly root: Locator;
  readonly applyButton: Locator;
  readonly movementRows: Locator;

  readonly inputs: Locators<AdjustmentField>;
  readonly texts: Locators<
    'name' | 'quantity' | 'status' | 'noSelection' | 'noMovements'
  >;
  readonly errors: Locators<'adjustment' | 'detail'>;

  constructor(page: Page) {
    this.root = page.getByTestId('inventory-inspector');
    this.applyButton = this.root.getByTestId('inventory-apply-adjustment');
    this.movementRows = this.root.getByTestId(/^inventory-movement-\d+$/);
    this.inputs = {
      delta: this.root.getByTestId('inventory-delta'),
      reason: this.root.getByTestId('inventory-reason'),
    };
    this.texts = {
      name: this.root.getByTestId('inventory-selected-name'),
      quantity: this.root.getByTestId('inventory-selected-quantity'),
      status: this.root.getByTestId('inventory-selected-status'),
      noSelection: this.root.getByTestId('inventory-no-selection'),
      noMovements: this.root.getByTestId('inventory-movements-empty'),
    };
    this.errors = {
      adjustment: this.root.getByTestId('inventory-adjustment-error'),
      detail: this.root.getByTestId('inventory-detail-error'),
    };
  }

  async fillAdjustment({ delta, reason }: AdjustmentInput): Promise<void> {
    await this.inputs.delta.fill(delta);
    await this.inputs.reason.fill(reason);
  }

  async apply(): Promise<void> {
    await this.applyButton.click();
  }

  async forceApply(): Promise<void> {
    await this.applyButton.click({ force: true });
    await this.applyButton.dispatchEvent('click');
  }

  async expectNoSelection(): Promise<void> {
    await expect(this.texts.noSelection).toBeVisible();
    await expect(this.applyButton).toBeHidden();
  }

  async expectToShow(item: InventoryItem): Promise<void> {
    await expect(this.texts.noSelection).toBeHidden();
    await expect(this.texts.name).toHaveText(item.name);
    await expect(this.texts.quantity).toHaveText(
      String(item.availableQuantity),
    );
    await expect(this.texts.status).toHaveText(
      STOCK_STATUS_LABELS[item.stockStatus],
    );
  }

  async expectNoMovements(): Promise<void> {
    await expect(this.texts.noMovements).toHaveText('No movements recorded.');
    await expect(this.movementRows).toHaveCount(0);
  }

  async expectMovements(newestFirst: ShownMovement[]): Promise<void> {
    await expect(this.movementRows).toHaveCount(newestFirst.length);
    await expect(this.texts.noMovements).toBeHidden();
    for (const [index, { id, delta, reason }] of newestFirst.entries()) {
      const row = this.movementRows.nth(index);
      await expect(row).toHaveAttribute(
        'data-testid',
        `inventory-movement-${id}`,
      );
      await expect(
        row.getByText('ADMIN ADJUSTMENT', { exact: true }),
      ).toBeVisible();
      await expect(row.getByText(signed(delta), { exact: true })).toBeVisible();
      await expect(row).toContainText(reason);
    }
  }

  async expectApplyDisabled(): Promise<void> {
    await expect(this.applyButton).toHaveText('Apply adjustment');
    await expect(this.applyButton).toBeDisabled();
  }

  async expectApplyEnabled(): Promise<void> {
    await expect(this.applyButton).toHaveText('Apply adjustment');
    await expect(this.applyButton).toBeEnabled();
  }

  async expectApplying(): Promise<void> {
    await expect(this.applyButton).toHaveText('Applying…');
    await expect(this.applyButton).toBeDisabled();
  }

  async expectClearedForm(): Promise<void> {
    await expect(this.inputs.delta).toHaveValue('');
    await expect(this.inputs.reason).toHaveValue('');
    await expect(this.errors.adjustment).toBeHidden();
    await this.expectApplyDisabled();
  }

  async expectConflictError(kept: AdjustmentInput): Promise<void> {
    await this.expectAdjustmentError(ADJUSTMENT_ERRORS.conflict, kept);
  }

  async expectGenericError(kept: AdjustmentInput): Promise<void> {
    await this.expectAdjustmentError(ADJUSTMENT_ERRORS.generic, kept);
  }

  async expectUnableToLoadProduct(): Promise<void> {
    await expect(this.errors.detail).toHaveAttribute('role', 'alert', {
      timeout: LOAD_ERROR_TIMEOUT_MS,
    });
    await expect(this.errors.detail).toContainText(
      'Unable to load this product',
    );
    await expect(this.errors.detail).toContainText(
      'It may no longer exist or the inventory service may be unavailable.',
    );
    await expect(this.texts.name).toBeHidden();
    await expect(this.applyButton).toBeHidden();
  }

  private async expectAdjustmentError(
    message: string,
    kept: AdjustmentInput,
  ): Promise<void> {
    await expect(this.errors.adjustment).toHaveAttribute('role', 'alert');
    await expect(this.errors.adjustment).toHaveText(message);
    await expect(this.inputs.delta).toHaveValue(kept.delta);
    await expect(this.inputs.reason).toHaveValue(kept.reason);
    await this.expectApplyEnabled();
  }
}
