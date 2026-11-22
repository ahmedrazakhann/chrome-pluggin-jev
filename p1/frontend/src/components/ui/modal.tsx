'use client';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ModalProps } from '@app-types/ui';

const SIZES = { md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };

// Open dialogs, innermost last: Escape closes only the top one, and the page stays locked until all are closed.
const openStack: symbol[] = [];

const Modal: React.FC<ModalProps> = ({ open, title, onClose, children, footer, size = 'lg' }) => {
  const titleId = useId();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const token = Symbol(title);
    openStack.push(token);
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && openStack[openStack.length - 1] === token) onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      openStack.splice(openStack.indexOf(token), 1);
      if (!openStack.length) document.body.style.overflow = '';
    };
  }, [open, title]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 px-3 py-6 md:py-12"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={event => event.stopPropagation()}
        className={`animate-scalePop w-full ${SIZES[size]} overflow-hidden rounded-sm bg-white shadow-2xl`}
      >
        <div className="flex items-center justify-between bg-[#4a4d52] px-4 py-2.5 text-white">
          <h2 id={titleId} className="text-sm font-semibold">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="rounded p-1 hover:bg-white/10">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto">{children}</div>
        {footer ? <div className="flex flex-wrap justify-center gap-2 border-t border-portal-line px-4 py-3">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
