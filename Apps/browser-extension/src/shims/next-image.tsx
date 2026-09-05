import React from 'react';

export function Image({
  src,
  alt = '',
  width,
  height,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & {
  src: string | { src: string };
  alt?: string;
  width?: number | string;
  height?: number | string;
}) {
  const resolvedSrc =
    typeof src === 'string'
      ? src
      : src && typeof src === 'object' && 'src' in src
        ? (src as { src: string }).src
        : '';
  return (
    <img
      src={resolvedSrc}
      alt={alt}
      width={width}
      height={height}
      {...props}
    />
  );
}

export default Image;
