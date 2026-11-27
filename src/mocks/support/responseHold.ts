export class ResponseHold {
  private held: Promise<void> = Promise.resolve();
  private releaseHeld: () => void = () => {};
  private holding = false;

  hold(): () => void {
    if (this.holding) {
      return this.releaseHeld;
    }
    this.holding = true;
    let resolveHeld: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      resolveHeld = resolve;
    });
    this.held = held;
    this.releaseHeld = () => {
      resolveHeld();
      if (this.held !== held) {
        return;
      }
      this.holding = false;
      this.held = Promise.resolve();
    };
    return this.releaseHeld;
  }

  release(): void {
    this.releaseHeld();
  }

  wait(): Promise<void> {
    return this.held;
  }
}
