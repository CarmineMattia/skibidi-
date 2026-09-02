import { Alert, Platform } from 'react-native';
import type { AlertButton } from 'react-native';

/**
 * Render an imperative dialog in the browser DOM.
 * Used only on web, where React Native's `Alert` is a no-op.
 */
function renderWebDialog(
  title: string,
  message?: string,
  buttons?: AlertButton[],
): void {
  if (typeof document === 'undefined') {
    return;
  }

  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:16px;';

  const dialog = document.createElement('div');
  dialog.style.cssText =
    'background:#fff;color:#111;border-radius:12px;max-width:340px;width:100%;padding:20px;font-family:system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,0.25);';

  const titleEl = document.createElement('div');
  titleEl.textContent = title;
  titleEl.style.cssText =
    'font-size:17px;font-weight:600;text-align:center;margin-bottom:10px;';
  dialog.appendChild(titleEl);

  if (message) {
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    messageEl.style.cssText =
      'font-size:14px;color:#4b5563;text-align:center;white-space:pre-wrap;margin-bottom:18px;';
    dialog.appendChild(messageEl);
  }

  const buttonsRow = document.createElement('div');
  buttonsRow.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

  const dismiss = (): void => {
    overlay.remove();
  };

  const effectiveButtons: AlertButton[] =
    buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];

  for (const button of effectiveButtons) {
    const buttonEl = document.createElement('button');
    buttonEl.textContent = button.text ?? '';
    const destructive = button.style === 'destructive';
    buttonEl.style.cssText = [
      'width:100%;padding:12px;border:none;border-radius:8px;font-size:15px;cursor:pointer;',
      destructive
        ? 'background:#dc2626;color:#fff;'
        : 'background:#f3f4f6;color:#111;',
    ].join('');
    buttonEl.addEventListener('click', () => {
      dismiss();
      button.onPress?.();
    });
    buttonsRow.appendChild(buttonEl);
  }

  dialog.appendChild(buttonsRow);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
}

let installed = false;

/**
 * Install a web polyfill for `Alert.alert`, which is a no-op on web.
 * Call once at app startup (e.g., in the root layout) so every `Alert.alert`
 * call site renders a dialog in the browser.
 */
export function installWebAlertPolyfill(): void {
  if (installed || Platform.OS !== 'web') {
    return;
  }
  installed = true;

  (Alert as unknown as {
    alert: (
      titleOrMessage: string,
      messageOrButtons?: string | AlertButton[],
      buttons?: AlertButton[],
    ) => void;
  }).alert = (titleOrMessage, messageOrButtons, buttons) => {
    // React Native's `Alert.alert` is overloaded: (message, buttons) or
    // (title, message, buttons). Disambiguate by the 2nd argument's type.
    let title: string;
    let message: string | undefined;
    let alertButtons: AlertButton[] | undefined;
    if (typeof messageOrButtons === 'string') {
      title = titleOrMessage;
      message = messageOrButtons;
      alertButtons = buttons;
    } else {
      title = titleOrMessage;
      alertButtons = messageOrButtons;
    }
    renderWebDialog(title, message, alertButtons);
  };
}
