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

    const previouslyFocused = document.activeElement;

    // Read the callback through a local so the listener does not have to be torn
    // down and rebuilt when a parent re-render hands us a new function identity.
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        if (!dialogRef.current) return;
        const focusable = dialogRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus first focusable element inside the modal, or the dialog container itself
    const focusable = dialogRef.current?.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable && focusable.length > 0) {
      focusable[0].focus();
    } else if (dialogRef.current) {
      dialogRef.current.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [isOpen, onClose]);

  return dialogRef;
}
