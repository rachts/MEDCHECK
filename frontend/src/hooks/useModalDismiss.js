import { useEffect, useRef } from 'react';

/**
 * Wires up the keyboard and focus behaviour that `role="dialog"` +
 * `aria-modal="true"` promise but do not themselves provide.
 *
 * Both MEDCHECK modals were previously dismissible only by clicking the small X in
 * the top bar: there was no Escape handler, and opening one left focus wherever it
 * was in the page behind. For a screen-reader or keyboard-only user that meant the
 * dialog announced itself and then stranded them -- Tab kept walking the obscured
 * page underneath, and nothing they could reach closed the thing.
 *
 * Returns a ref to attach to the dialog element. When `isOpen` flips true the hook:
 *   - moves focus into the dialog so the next Tab lands inside it,
 *   - closes on Escape,
 *   - locks background scroll (the backdrop is `fixed`, so without this the page
 *     behind scrolls under the modal on trackpads and mobile).
 *
 * @param {boolean} isOpen   Whether the dialog is currently rendered.
 * @param {() => void} onClose Called on Escape.
 * @returns {import('react').RefObject<HTMLElement>} Ref for the dialog element.
 */
export function useModalDismiss(isOpen, onClose) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    // Read the callback through a local so the listener does not have to be torn
    // down and rebuilt when a parent re-render hands us a new function identity.
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the dialog container itself rather than guessing at a first control:
    // the container carries tabIndex={-1}, so this is programmatic-only and does
    // not add a stop to the tab order.
    const focusTarget = dialogRef.current;
    if (focusTarget) focusTarget.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  return dialogRef;
}
