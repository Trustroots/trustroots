import React from 'react';
import './screenshot.css';

type ScreenshotProps = {
  png: string;
  png2x: string;
  webp: string;
  webp2x: string;
};

export default function Screenshot({
  png,
  png2x,
  webp,
  webp2x,
}: ScreenshotProps) {
  return (
    <div className="screenshot-browser">
      <div className="screenshot-browser-circle" />
      <div className="screenshot-browser-circle" />
      <div className="screenshot-browser-circle" />
      <picture className="screenshot-browser-picture">
        <source srcSet={`${webp}, ${webp2x} 2x,`} type="image/webp" />
        <source srcSet={`${png}, ${png2x} 2x`} type="image/png" />
        <img alt="" src={png} />
      </picture>
    </div>
  );
}
