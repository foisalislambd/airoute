"use client";

import { useId, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/shared/utils/cn";

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: React.ReactNode;
  error?: React.ReactNode;
  hint?: React.ReactNode;
  icon?: string;
  inputClassName?: string;
}

export default function Input({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  hint,
  icon,
  disabled = false,
  required = false,
  className,
  inputClassName,
  id: externalId,
  onKeyDown: externalOnKeyDown,
  onKeyUp: externalOnKeyUp,
  ...props
}: InputProps) {
  const t = useTranslations("common");
  const generatedId = useId();
  const inputId = externalId || generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint && !error ? `${inputId}-hint` : undefined;
  const capsLockId = `${inputId}-capslock`;
  const isPassword = type === "password";
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const detectCapsLock = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (isPassword) {
        setCapsLockOn(e.getModifierState("CapsLock"));
      }
    },
    [isPassword]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      detectCapsLock(e);
      externalOnKeyDown?.(e);
    },
    [detectCapsLock, externalOnKeyDown]
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      detectCapsLock(e);
      externalOnKeyUp?.(e);
    },
    [detectCapsLock, externalOnKeyUp]
  );

  const showCapsLock = isPassword && capsLockOn && inputFocused;
  const describedBy =
    [errorId, showCapsLock ? capsLockId : undefined, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text-main">
          {label}
          {required && (
            <span className="text-red-500 ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-text-muted">
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              {icon}
            </span>
          </div>
        )}
        <input
          id={inputId}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onFocus={(e) => {
            setInputFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setInputFocused(false);
            setCapsLockOn(false);
            props.onBlur?.(e);
          }}
          className={cn(
            "h-11 w-full px-3 text-sm text-gray-900 dark:text-white",
            "rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900",
            "placeholder:text-gray-400",
            "focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20",
            "transition disabled:cursor-not-allowed disabled:opacity-50",
            // iOS zoom fix
            "text-[16px] sm:text-sm",
            icon && "pl-10",
            error ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "",
            inputClassName
          )}
          {...props}
        />
      </div>
      {showCapsLock && (
        <p
          id={capsLockId}
          className="text-xs text-amber-500 dark:text-amber-400 flex items-center gap-1 animate-in fade-in duration-200"
          role="status"
          aria-live="polite"
        >
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
            keyboard_capslock
          </span>
          {t("capsLockOn")}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-red-500 flex items-center gap-1" role="alert">
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
            error
          </span>
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="text-xs text-text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
