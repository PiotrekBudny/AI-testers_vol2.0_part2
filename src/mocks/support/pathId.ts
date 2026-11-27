export function pathId(url: string, positionFromEnd = 0): number {
  return Number(
    new URL(url).pathname
      .split('/')
      .filter(Boolean)
      .at(-1 - positionFromEnd),
  );
}
