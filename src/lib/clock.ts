// Single source of "now" so the seed and tests can drive time deterministically.
let frozen: Date | null = null;

export function now(): Date {
  return frozen ? new Date(frozen) : new Date();
}

export function setClock(at: Date | null): void {
  frozen = at ? new Date(at) : null;
}
