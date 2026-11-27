import React from 'react';

const circleClass =
  'tw:float-start tw:me-[5px] tw:mb-2.5 tw:size-2.5 tw:rounded-full tw:border tw:border-solid tw:border-[#999] tw:[@media(max-width:991px)]:me-[3px] tw:[@media(max-width:991px)]:mb-[5px] tw:[@media(max-width:991px)]:size-[5px]';

type ScreenshotProps = {
  png: string;
  png2x: string;
  webp: string;
  webp2x: string;
  width: number;
  height: number;
};

export default function Screenshot({
  png,
  png2x,
  webp,
  webp2x,
  width,
  height,
}: ScreenshotProps) {
  return (
    <div className="tw:mx-auto tw:my-2.5 tw:w-full tw:max-w-[620px] tw:rounded-[10px] tw:border tw:border-solid tw:border-[#999] tw:p-2.5 tw:[@media(max-width:991px)]:rounded-[6px] tw:[@media(max-width:991px)]:p-[5px]">
      <div className={circleClass} />
      <div className={circleClass} />
      <div className={circleClass} />
      <picture className="tw:clear-both tw:mx-auto tw:block tw:w-full tw:max-w-[600px] tw:overflow-hidden tw:rounded-[5px] tw:bg-no-repeat tw:[@media(max-width:991px)]:rounded-[3px]">
        <source srcSet={`${webp}, ${webp2x} 2x,`} type="image/webp" />
        <source srcSet={`${png}, ${png2x} 2x`} type="image/png" />
        <img
          alt=""
          className="tw:block tw:h-auto tw:max-w-full"
          src={png}
          width={width}
          height={height}
        />
      </picture>
    </div>
  );
}
