import React, { type ComponentProps } from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { cn } from '#lib/cn';
import {
  fieldBase,
  fieldPlaceholder,
  fieldSizes,
  fieldState,
} from '#lib/fieldStyles';

type Option = { value: string; label: string };

type MultiComboboxProps<T extends Option> = Pick<
  ComponentProps<'input'>,
  'aria-label' | 'aria-labelledby' | 'disabled' | 'placeholder'
> & {
  items: T[];
  filteredItems: T[];
  value: T[];
  inputValue: string;
  onInputValueChange: (value: string) => void;
  onValueChange: (value: T[]) => void;
  emptyMessage: string;
  removeLabel: (option: T) => string;
};

export function MultiCombobox<T extends Option>({
  items,
  filteredItems,
  value,
  inputValue,
  onInputValueChange,
  onValueChange,
  disabled,
  emptyMessage,
  removeLabel,
  ...inputProps
}: MultiComboboxProps<T>) {
  return (
    <Combobox.Root<T, true>
      multiple
      items={items}
      filteredItems={filteredItems}
      value={value}
      inputValue={inputValue}
      onValueChange={onValueChange}
      onInputValueChange={onInputValueChange}
      isItemEqualToValue={(item, selected) => item.value === selected.value}
      disabled={disabled}
      autoHighlight
    >
      <Combobox.InputGroup className="tw:w-full">
        <Combobox.Chips className="tw:mb-1 tw:flex tw:flex-wrap tw:gap-1 tw:empty:hidden">
          {value.map(option => (
            <Combobox.Chip
              key={option.value}
              className="tw:inline-flex tw:items-center tw:gap-1 tw:rounded-sm tw:bg-gray-100 tw:ps-2 tw:text-sm"
            >
              {option.label}
              <Combobox.ChipRemove
                aria-label={removeLabel(option)}
                className="tw:min-h-7 tw:min-w-7 tw:rounded-sm tw:border-0 tw:bg-transparent tw:hover:bg-gray-200 tw:focus-visible:outline-2"
              >
                <span aria-hidden="true">×</span>
              </Combobox.ChipRemove>
            </Combobox.Chip>
          ))}
        </Combobox.Chips>
        <Combobox.Input
          {...inputProps}
          className={cn(fieldBase, fieldSizes.md, fieldState, fieldPlaceholder)}
        />
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="tw:z-[1100]">
          <Combobox.Popup className="tw:w-(--anchor-width) tw:rounded-md tw:border tw:border-gray-200 tw:bg-white tw:shadow-md">
            <Combobox.Empty className="tw:px-3 tw:py-2 tw:text-sm tw:empty:hidden">
              {emptyMessage}
            </Combobox.Empty>
            <Combobox.List className="tw:max-h-60 tw:overflow-auto">
              {(option: T) => (
                <Combobox.Item
                  key={option.value}
                  value={option}
                  className="tw:flex tw:cursor-pointer tw:items-center tw:justify-between tw:gap-2 tw:px-3 tw:py-2 tw:data-highlighted:bg-blue-50"
                >
                  {option.label}
                  <Combobox.ItemIndicator aria-hidden="true">
                    ✓
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
