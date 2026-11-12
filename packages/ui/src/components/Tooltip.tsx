import React, {
  useId,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react';
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';

type TooltipProps = {
  children: ReactElement;
  tooltip: string;
  placement?: 'left' | 'top' | 'right' | 'bottom';
  hidden?: boolean;
};

// Base UI reports the physical side. Keep these offsets out of RTL CSS mirroring.
const arrowOffsets: Partial<
  Record<BaseTooltip.Arrow.State['side'], CSSProperties>
> = {
  top: { bottom: '-0.25rem' },
  bottom: { top: '-0.25rem' },
  left: { right: '-0.25rem' },
  right: { left: '-0.25rem' },
};

export function Tooltip({ hidden = false, ...props }: TooltipProps) {
  return hidden ? props.children : <VisibleTooltip {...props} />;
}

function VisibleTooltip({
  children,
  tooltip,
  placement = 'top',
}: Omit<TooltipProps, 'hidden'>) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <BaseTooltip.Root open={open} onOpenChange={setOpen}>
      <BaseTooltip.Trigger
        render={children}
        delay={0}
        aria-describedby={open ? id : undefined}
      />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner
          side={placement}
          sideOffset={6}
          className="tw:z-[1080]"
        >
          <BaseTooltip.Popup
            id={id}
            role="tooltip"
            data-slot="tooltip"
            className="tw:max-w-[200px] tw:rounded-md tw:bg-black tw:px-2 tw:py-1 tw:text-center tw:font-base tw:text-sm tw:leading-normal tw:font-normal tw:wrap-break-word tw:text-white tw:opacity-90"
          >
            <BaseTooltip.Arrow
              className="tw:size-2 tw:rotate-45 tw:bg-black"
              style={({ side }) => arrowOffsets[side]}
            />
            {tooltip}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
