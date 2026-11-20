import React, { type ComponentProps } from 'react';
import { Button } from '@trustroots/ui/Button';
import { Input } from '@trustroots/ui/Input';

type AuthPasswordInputProps = Omit<
  ComponentProps<typeof Input>,
  'type' | 'fieldSize' | 'className'
> & {
  visible: boolean;
  onToggleVisibility: () => void;
};

export function AuthPasswordInput({
  visible,
  onToggleVisibility,
  ...props
}: AuthPasswordInputProps) {
  return (
    <div className="tw:relative tw:flex tw:items-stretch">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        fieldSize="lg"
        className="tw:relative tw:w-px tw:min-w-0 tw:flex-auto tw:rounded-e-none tw:focus:z-2"
      />
      <Button
        size="lg"
        className="tw:relative tw:z-3 tw:inline-flex tw:size-[46px] tw:shrink-0 tw:items-center tw:justify-center tw:border-0 tw:p-0 tw:hover:bg-white tw:active:shadow-none"
        type="button"
        aria-label="Toggle password visibility"
        aria-pressed={visible}
        onClick={onToggleVisibility}
      >
        <i
          className={visible ? 'icon-lg icon-eye-off' : 'icon-lg icon-eye'}
          aria-hidden="true"
        />
      </Button>
    </div>
  );
}
