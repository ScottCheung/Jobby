/** @format */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from './Button';

type ImageCropperProps = {
  file: File;
  aspectRatio?: number;
  maxOutputEdge?: number;
  outputQuality?: number;
  title?: string;
  onConfirm: (file: File) => void;
  onCancel: () => void;
};

type Size = { width: number; height: number };

export function ImageCropper({
  file,
  aspectRatio = 16 / 9,
  maxOutputEdge = 1280,
  outputQuality = 0.85,
  title = 'Crop image',
  onConfirm,
  onCancel,
}: ImageCropperProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    type: 'move' | 'nw' | 'ne' | 'sw' | 'se';
    startX: number;
    startY: number;
    startCrop: { x: number; y: number; width: number; height: number };
  } | null>(null);

  const [sourceUrl, setSourceUrl] = useState('');
  const [imageSize, setImageSize] = useState<Size | null>(null);
  const [frameSize, setFrameSize] = useState<Size>({ width: 0, height: 0 });
  const [crop, setCrop] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.src = url;
    setSourceUrl(url);
    setCrop(null); // Reset crop state when file changes
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setFrameSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  // Calculate container dimensions matching image aspect ratio inside the frame width & max height bounds
  const maxContainerHeight = 360;
  const imageAspectRatio = imageSize ? imageSize.width / imageSize.height : 1;

  // Fit image dimensions inside frame width with a max height limit
  let finalContainerWidth = frameSize.width;
  let finalContainerHeight = frameSize.width / imageAspectRatio;

  if (finalContainerHeight > maxContainerHeight) {
    finalContainerHeight = maxContainerHeight;
    finalContainerWidth = maxContainerHeight * imageAspectRatio;
  }

  // Initialize crop to maximum size keeping target aspect ratio
  const lastFileRef = useRef<File | null>(null);

  useEffect(() => {
    if (!imageSize || finalContainerWidth <= 10 || finalContainerHeight <= 10)
      return;

    const isNewFile = lastFileRef.current !== file;
    if (!crop || isNewFile) {
      lastFileRef.current = file;

      let cropWidth = finalContainerWidth;
      let cropHeight = finalContainerWidth / aspectRatio;

      if (cropHeight > finalContainerHeight) {
        cropHeight = finalContainerHeight;
        cropWidth = finalContainerHeight * aspectRatio;
      }

      const cropX = (finalContainerWidth - cropWidth) / 2;
      const cropY = (finalContainerHeight - cropHeight) / 2;

      setCrop({
        x: Math.round(cropX),
        y: Math.round(cropY),
        width: Math.round(cropWidth),
        height: Math.round(cropHeight),
      });
    }
  }, [
    file,
    imageSize,
    finalContainerWidth,
    finalContainerHeight,
    aspectRatio,
    crop,
  ]);

  // Rescale crop region proportionally when window/container resizes
  const lastContainerSize = useRef<{ width: number; height: number } | null>(
    null,
  );

  useEffect(() => {
    if (finalContainerWidth <= 10 || finalContainerHeight <= 10) return;

    if (crop && lastContainerSize.current) {
      const prevWidth = lastContainerSize.current.width;
      const prevHeight = lastContainerSize.current.height;
      if (
        prevWidth !== finalContainerWidth ||
        prevHeight !== finalContainerHeight
      ) {
        const scaleX = finalContainerWidth / prevWidth;
        const scaleY = finalContainerHeight / prevHeight;

        setCrop({
          x: Math.round(crop.x * scaleX),
          y: Math.round(crop.y * scaleY),
          width: Math.round(crop.width * scaleX),
          height: Math.round(crop.height * scaleY),
        });
      }
    }
    lastContainerSize.current = {
      width: finalContainerWidth,
      height: finalContainerHeight,
    };
  }, [finalContainerWidth, finalContainerHeight, crop]);

  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    type: 'move' | 'nw' | 'ne' | 'sw' | 'se',
  ) => {
    e.stopPropagation();
    const container = containerRef.current;
    if (container) {
      container.setPointerCapture(e.pointerId);
    }
    if (crop) {
      dragRef.current = {
        type,
        startX: e.clientX,
        startY: e.clientY,
        startCrop: { ...crop },
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !crop) return;
    const { type, startX, startY, startCrop } = dragRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const minWidth = 40;

    if (type === 'move') {
      let newX = startCrop.x + dx;
      let newY = startCrop.y + dy;
      newX = Math.max(0, Math.min(finalContainerWidth - startCrop.width, newX));
      newY = Math.max(
        0,
        Math.min(finalContainerHeight - startCrop.height, newY),
      );
      setCrop({ ...startCrop, x: Math.round(newX), y: Math.round(newY) });
    } else {
      let newWidth = startCrop.width;
      let newHeight = startCrop.height;
      let newX = startCrop.x;
      let newY = startCrop.y;

      const fixedRight = startCrop.x + startCrop.width;
      const fixedBottom = startCrop.y + startCrop.height;

      if (type === 'se') {
        newWidth = startCrop.width + dx;
        newWidth = Math.max(
          minWidth,
          Math.min(finalContainerWidth - startCrop.x, newWidth),
        );
        newHeight = newWidth / aspectRatio;
        if (startCrop.y + newHeight > finalContainerHeight) {
          newHeight = finalContainerHeight - startCrop.y;
          newWidth = newHeight * aspectRatio;
        }
      } else if (type === 'sw') {
        newX = startCrop.x + dx;
        newX = Math.max(0, Math.min(fixedRight - minWidth, newX));
        newWidth = fixedRight - newX;
        newHeight = newWidth / aspectRatio;
        if (startCrop.y + newHeight > finalContainerHeight) {
          newHeight = finalContainerHeight - startCrop.y;
          newWidth = newHeight * aspectRatio;
          newX = fixedRight - newWidth;
        }
      } else if (type === 'ne') {
        newWidth = startCrop.width + dx;
        newWidth = Math.max(
          minWidth,
          Math.min(finalContainerWidth - startCrop.x, newWidth),
        );
        newHeight = newWidth / aspectRatio;
        newY = fixedBottom - newHeight;
        if (newY < 0) {
          newY = 0;
          newHeight = fixedBottom;
          newWidth = newHeight * aspectRatio;
        }
      } else if (type === 'nw') {
        newX = startCrop.x + dx;
        newX = Math.max(0, Math.min(fixedRight - minWidth, newX));
        newWidth = fixedRight - newX;
        newHeight = newWidth / aspectRatio;
        newY = fixedBottom - newHeight;
        if (newY < 0) {
          newY = 0;
          newHeight = fixedBottom;
          newWidth = newHeight * aspectRatio;
          newX = fixedRight - newWidth;
        }
      }

      setCrop({
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newWidth),
        height: Math.round(newHeight),
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null;
  };

  const confirmCrop = () => {
    if (!crop || !imageSize) return;

    // Scale back to natural image size
    const scale = imageSize.width / finalContainerWidth;
    const sourceX = Math.max(0, Math.min(imageSize.width, crop.x * scale));
    const sourceY = Math.max(0, Math.min(imageSize.height, crop.y * scale));
    const sourceWidth = Math.max(
      1,
      Math.min(imageSize.width - sourceX, crop.width * scale),
    );
    const sourceHeight = Math.max(
      1,
      Math.min(imageSize.height - sourceY, crop.height * scale),
    );

    const outputWidth = Math.min(
      maxOutputEdge,
      Math.max(1, Math.round(sourceWidth)),
    );
    const outputHeight = Math.max(1, Math.round(outputWidth / aspectRatio));

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
          image,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          outputWidth,
          outputHeight,
        );
      }
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          onConfirm(
            new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, {
              type: 'image/webp',
            }),
          );
        },
        'image/webp',
        outputQuality,
      );
    };
    image.src = sourceUrl;
  };

  return (
    <div className='rounded-2xl rounded-bl-[4em]! border border-primary bg-background/35 p-4 flex flex-col gap-4 w-full'>
      <div className='text-sm font-semibold text-ink-primary'>{title}</div>

      <div
        ref={frameRef}
        className='relative w-full min-h-[220px] flex items-center justify-center rounded-xl bg-zinc-950/60 overflow-hidden select-none p-4'
      >
        {!imageSize || !crop ?
          <div className='absolute inset-0 flex items-center justify-center bg-background-secondary animate-text-shimmer-primary animate-text-shimmer rounded-xl'>
            <div className='text-xs text-ink-secondary'>
              Loading image preview...
            </div>
          </div>
        : <div
            ref={containerRef}
            className='relative shadow-xl touch-none select-none'
            style={{
              width: finalContainerWidth,
              height: finalContainerHeight,
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* The Image */}
            <img
              src={sourceUrl}
              alt='Crop preview'
              draggable={false}
              className='w-full h-full object-cover select-none pointer-events-none rounded-sm'
            />

            {/* Dark Overlays (dimmed area outside crop viewport) */}
            <div
              className='absolute bg-black/60 pointer-events-none'
              style={{ left: 0, top: 0, width: '100%', height: crop.y }}
            />
            <div
              className='absolute bg-black/60 pointer-events-none'
              style={{
                left: 0,
                top: crop.y + crop.height,
                width: '100%',
                height: finalContainerHeight - (crop.y + crop.height),
              }}
            />
            <div
              className='absolute bg-black/60 pointer-events-none'
              style={{
                left: 0,
                top: crop.y,
                width: crop.x,
                height: crop.height,
              }}
            />
            <div
              className='absolute bg-black/60 pointer-events-none'
              style={{
                left: crop.x + crop.width,
                top: crop.y,
                width: finalContainerWidth - (crop.x + crop.width),
                height: crop.height,
              }}
            />

            {/* Crop Box Area */}
            <div
              className='absolute border-2 border-white/80 cursor-move shadow-[0_0_0_1px_rgba(0,0,0,0.5)]'
              style={{
                left: crop.x,
                top: crop.y,
                width: crop.width,
                height: crop.height,
              }}
              onPointerDown={(e) => handlePointerDown(e, 'move')}
            >
              {/* Rule of Thirds Grid Lines */}
              <div className='absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-45 group-hover:opacity-75 transition-opacity'>
                <div className='border-r border-b border-white/30' />
                <div className='border-r border-b border-white/30' />
                <div className='border-b border-white/30' />
                <div className='border-r border-b border-white/30' />
                <div className='border-r border-b border-white/30' />
                <div className='border-b border-white/30' />
                <div className='border-r border-white/30' />
                <div className='border-r border-white/30' />
                <div />
              </div>

              {/* Resize Handles */}
              <div
                className='absolute -top-1.5 -left-1.5 w-4 h-4 border-t-[3px] border-l-[3px] border-white cursor-nwse-resize drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] hover:scale-125 transition-transform'
                onPointerDown={(e) => handlePointerDown(e, 'nw')}
              />
              <div
                className='absolute -top-1.5 -right-1.5 w-4 h-4 border-t-[3px] border-r-[3px] border-white cursor-nesw-resize drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] hover:scale-125 transition-transform'
                onPointerDown={(e) => handlePointerDown(e, 'ne')}
              />
              <div
                className='absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-[3px] border-l-[3px] border-white cursor-nesw-resize drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] hover:scale-125 transition-transform'
                onPointerDown={(e) => handlePointerDown(e, 'sw')}
              />
              <div
                className='absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-[3px] border-r-[3px] border-white cursor-nwse-resize drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] hover:scale-125 transition-transform'
                onPointerDown={(e) => handlePointerDown(e, 'se')}
              />
            </div>
          </div>
        }
      </div>

      <div className='flex items-center justify-between text-[11px] text-ink-secondary px-1'>
        <div>Drag crop box corners to scale, drag center to position.</div>
      </div>

      <div className='flex justify-end gap-3'>
        <Button
          type='button'
          variant='outline'
          onClick={onCancel}
          className='rounded-xl'
        >
          Cancel
        </Button>
        <Button
          type='button'
          Icon={Check}
          onClick={confirmCrop}
          disabled={!crop}
          className='rounded-xl'
        >
          Use crop
        </Button>
      </div>
    </div>
  );
}
