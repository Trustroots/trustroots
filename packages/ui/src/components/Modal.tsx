import React, { useRef, type ReactNode, type RefObject } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { cva } from 'class-variance-authority';

import { cn } from '#lib/utils';

/*
 * Bootstrap 5.3 `.modal` geometry on Base UI's Dialog, with the app's own
 * overrides (a grey header with 10px vertical padding, a large title). The
 * colours and borders are Bootstrap's `--bs-*` variables, which the app's
 * Bootstrap stylesheet defines on :root.
 *
 * Bootstrap's `.modal-dialog` and `.modal-content` are one element here, the
 * popup: it keeps the dialog's margins and width and the content's frame.
 */
const popupVariants = cva(
  [
    'tw:relative tw:flex tw:w-auto tw:flex-col tw:outline-0',
    'tw:[--modal-margin:0.5rem] tw:m-(--modal-margin) tw:min-[576px]:[--modal-margin:1.75rem] tw:min-[576px]:mx-auto',
    'tw:rounded-(--bs-border-radius-lg) tw:border-(length:--bs-border-width) tw:border-solid tw:border-(--bs-border-color-translucent)',
    'tw:bg-(--bs-body-bg) tw:bg-clip-padding tw:text-(--bs-body-color)',
    // Bootstrap's fade: the dialog fades in and slides down 50px.
    'tw:[transition:opacity_0.15s_linear,translate_0.3s_ease-out] tw:motion-reduce:transition-none',
    'tw:data-starting-style:-translate-y-[50px] tw:data-starting-style:opacity-0 tw:data-ending-style:-translate-y-[50px] tw:data-ending-style:opacity-0',
  ],
  {
    variants: {
      size: {
        md: 'tw:min-[576px]:max-w-[500px]',
        lg: 'tw:min-[576px]:max-w-[500px] tw:min-[992px]:max-w-[800px]',
      },
      // The frame fits the viewport and only the body scrolls.
      scrollable: {
        true: 'tw:max-h-[calc(100%-2*var(--modal-margin))] tw:overflow-hidden tw:*:data-[slot=modal-body]:overflow-y-auto',
      },
    },
  },
);

export type ModalSize = 'md' | 'lg';

type ModalProps = {
  open: boolean;
  /** Called when the dialog asks to close: Escape, a backdrop click or the close button. */
  onClose: () => void;
  /**
   * Whether Escape and a backdrop click close the dialog. Turn it off while
   * the dialog's action is in progress. Defaults to `true`.
   */
  dismissible?: boolean;
  /** Defaults to `md`, 500px wide; `lg` is 800px on wide screens. */
  size?: ModalSize;
  /** Keeps the dialog within the viewport and scrolls its body. */
  scrollable?: boolean;
  /**
   * The element to focus when the dialog opens. By default the dialog itself
   * takes focus, so the first Tab reaches its first control.
   */
  initialFocus?: RefObject<HTMLElement | null>;
  /** Layout for the dialog box, such as a custom width. */
  className?: string;
  children?: ReactNode;
};

/**
 * A modal dialog. Focus is trapped inside while it is open and returns to
 * the element that had it when it closes. Give it a `ModalTitle`, which
 * labels the dialog.
 */
export function Modal({
  open,
  onClose,
  dismissible = true,
  size = 'md',
  scrollable = false,
  initialFocus,
  className,
  children,
}: ModalProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root
      open={open}
      disablePointerDismissal={!dismissible}
      // There is no trigger part, so every change is a request to close.
      onOpenChange={(_open, eventDetails) => {
        if (!dismissible && eventDetails.reason === 'escape-key') {
          eventDetails.cancel();
          return;
        }
        onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          data-slot="modal-backdrop"
          className="tw:fixed tw:start-0 tw:top-0 tw:z-1050 tw:h-screen tw:w-screen tw:bg-black tw:opacity-50 tw:transition-opacity tw:duration-150 tw:ease-linear tw:data-ending-style:opacity-0 tw:data-starting-style:opacity-0 tw:motion-reduce:transition-none"
        />
        <Dialog.Viewport
          data-slot="modal-viewport"
          className="tw:fixed tw:start-0 tw:top-0 tw:z-1055 tw:h-full tw:w-full tw:overflow-x-hidden tw:overflow-y-auto tw:outline-0"
        >
          <Dialog.Popup
            ref={popupRef}
            initialFocus={initialFocus ?? popupRef}
            data-slot="modal"
            data-size={size}
            className={cn(popupVariants({ size, scrollable }), className)}
          >
            {children}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type ModalHeaderProps = {
  /**
   * The close button's accessible name. When set, the header shows a close
   * button; leave it out while closing is not allowed.
   */
  closeLabel?: string;
  children: ReactNode;
};

export function ModalHeader({ closeLabel, children }: ModalHeaderProps) {
  return (
    <div
      data-slot="modal-header"
      className="tw:flex tw:shrink-0 tw:items-center tw:rounded-t-[calc(var(--bs-border-radius-lg)-var(--bs-border-width))] tw:border-0 tw:border-b-(length:--bs-border-width) tw:border-solid tw:border-(--bs-border-color) tw:bg-(--tr-gray-lighter) tw:px-4 tw:py-2.5"
    >
      {children}
      {closeLabel && (
        <Dialog.Close
          aria-label={closeLabel}
          data-slot="modal-close"
          className="tw:-me-2 tw:-my-2 tw:ms-auto tw:box-content tw:size-[1em] tw:cursor-pointer tw:rounded-[0.375rem] tw:border-0 tw:bg-transparent tw:p-2 tw:text-black tw:opacity-50 tw:hover:opacity-75 tw:focus:opacity-100 tw:focus:shadow-[0_0_0_0.25rem_rgba(13,110,253,0.25)] tw:focus:outline-0"
        >
          {/* Bootstrap's `.btn-close` cross. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="tw:block tw:size-[1em]"
          >
            <path d="M.293.293a1 1 0 0 1 1.414 0L8 6.586 14.293.293a1 1 0 1 1 1.414 1.414L9.414 8l6.293 6.293a1 1 0 0 1-1.414 1.414L8 9.414l-6.293 6.293a1 1 0 0 1-1.414-1.414L6.586 8 .293 1.707a1 1 0 0 1 0-1.414" />
          </svg>
        </Dialog.Close>
      )}
    </div>
  );
}

/** Labels the dialog: the popup's `aria-labelledby` points at it. */
export function ModalTitle({
  id,
  children,
}: {
  id?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Title
      id={id}
      data-slot="modal-title"
      render={<div />}
      className="tw:m-0 tw:text-(length:--tr-font-size-large) tw:leading-normal tw:font-medium"
    >
      {children}
    </Dialog.Title>
  );
}

export function ModalBody({ children }: { children: ReactNode }) {
  return (
    <div data-slot="modal-body" className="tw:relative tw:flex-auto tw:p-4">
      {children}
    </div>
  );
}

/** Actions, aligned to the end with Bootstrap's 0.5rem gap. */
export function ModalFooter({ children }: { children: ReactNode }) {
  return (
    <div
      data-slot="modal-footer"
      className="tw:flex tw:shrink-0 tw:flex-wrap tw:items-center tw:justify-end tw:rounded-b-[calc(var(--bs-border-radius-lg)-var(--bs-border-width))] tw:border-0 tw:border-t-(length:--bs-border-width) tw:border-solid tw:border-(--bs-border-color) tw:p-3 tw:*:m-1"
    >
      {children}
    </div>
  );
}
