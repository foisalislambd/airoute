"use client";

import { useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { cn } from "@/shared/utils/cn";
import { lockBodyScroll } from "@/shared/utils/bodyScrollLock";
import Button, { type ButtonVariant } from "./Button";

// #6265 — preset for content-heavy modals: caps height on the OUTERMOST dialog
// wrapper only (single scroll owner) and keeps the inner body plain (no
// independent max-h/overflow), avoiding a double height cap that clips content.
export const TALL_MODAL_PROPS = {
  className: "max-h-[90vh] overflow-y-auto",
  bodyClassName: "p-6",
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  closeOnOverlay?: boolean;
  showCloseButton?: boolean;
  className?: string;
  bodyClassName?: string;
  compactHeader?: boolean;
  maxWidth?: string;
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: React.ReactNode;
  message: React.ReactNode;
  confirmText?: React.ReactNode;
  cancelText?: React.ReactNode;
  variant?: ButtonVariant;
  loading?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
  closeOnOverlay = true,
  showCloseButton = true,
  className,
  bodyClassName,
  compactHeader = false,
}: ModalProps) {
  const t = useTranslations("common");
  const titleId = useId();
  const dialogRef = useRef(null);

  const sizes = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    full: "max-w-4xl",
  };

  // Lock body scroll when modal is open (ref-counted for nested overlays)
  useEffect(() => {
    if (!isOpen) return;
    return lockBodyScroll();
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;

    const dialog = dialogRef.current;
    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const firstFocusable = dialog.querySelector(focusableSelector) as HTMLElement | null;
    if (firstFocusable) {
      setTimeout(() => firstFocusable.focus(), 50);
    }

    const handleTab = (e) => {
      if (e.key !== "Tab") return;

      const focusable = Array.from(
        dialog.querySelectorAll(focusableSelector)
      ) as HTMLElement[];
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", handleTab);
    return () => dialog.removeEventListener("keydown", handleTab);
  }, [isOpen]);

  if (!isOpen) return null;

  const modal = (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-[2px]"
        onClick={closeOnOverlay ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={cn(
          "app-card relative w-full shadow-xl",
          "max-h-[92dvh] overflow-hidden sm:max-h-[90vh]",
          "rounded-t-2xl sm:rounded-xl",
          "animate-in fade-in zoom-in-95 duration-200",
          sizes[size],
          className
        )}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div
            className={cn(
              "flex items-center justify-between border-b border-gray-200 dark:border-gray-800",
              compactHeader ? "px-4 py-2.5" : "px-5 py-4 sm:px-6"
            )}
          >
            {title ? (
              <h2
                id={titleId}
                className={cn(
                  "min-w-0 truncate font-semibold text-gray-900 dark:text-white",
                  compactHeader ? "text-sm" : "text-base sm:text-lg"
                )}
              >
                {title}
              </h2>
            ) : (
              <span />
            )}
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label={t("close")}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 dark:hover:bg-white/5"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  close
                </span>
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div
          className={cn(
            "app-scrollbar overflow-y-auto",
            bodyClassName ?? "max-h-[calc(80vh-140px)] p-5 sm:p-6"
          )}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex flex-col-reverse items-stretch justify-end gap-2 border-t border-gray-200 p-4 sm:flex-row sm:items-center sm:gap-3 sm:p-6 dark:border-gray-800">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  // Portal to body so transform/overflow ancestors (mobile drawer) cannot clip or re-root fixed UI.
  if (typeof document === "undefined") return modal;
  return createPortal(modal, document.body);
}

// Confirm Modal helper
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  variant = "danger",
  loading = false,
}: ConfirmModalProps) {
  const t = useTranslations("common");
  const resolvedTitle = title ?? t("confirmTitle");
  const resolvedConfirmText = confirmText ?? t("confirmAction");
  const resolvedCancelText = cancelText ?? t("cancel");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={resolvedTitle}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {resolvedCancelText}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {resolvedConfirmText}
          </Button>
        </>
      }
    >
      <p className="text-text-muted">{message}</p>
    </Modal>
  );
}
