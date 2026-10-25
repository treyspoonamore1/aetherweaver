/**
 * Human-readable key labels for KeyboardEvent.code values. Uses the browser's keyboard
 * layout map where available (Chromium), so an AZERTY player sees "Z" for KeyW.
 */
let layoutMap: Map<string, string> | null = null;

interface KeyboardWithLayout {
  getLayoutMap?: () => Promise<Map<string, string>>;
}

export async function loadKeyboardLayout(): Promise<void> {
  try {
    const keyboard = (navigator as Navigator & { keyboard?: KeyboardWithLayout }).keyboard;
    if (keyboard?.getLayoutMap) layoutMap = await keyboard.getLayoutMap();
  } catch {
    layoutMap = null;
  }
}

const SPECIAL: Record<string, string> = {
  Space: 'Space',
  Escape: 'Esc',
  Backquote: '`',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl',
  Tab: 'Tab',
  Enter: 'Enter',
};

export function keyLabel(code: string): string {
  const fromLayout = layoutMap?.get(code);
  if (fromLayout && fromLayout.trim()) return fromLayout.toUpperCase();
  if (SPECIAL[code]) return SPECIAL[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (/^F\d+$/.test(code)) return code;
  return code;
}
