/** @format */

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';

export type LogoMode = 'logo' | 'brand' | 'hover';

export interface LogoProps {
  /** 显示模式：logo(只显示logo) | brand(只显示brand) | hover(默认logo，hover显示brand) */
  mode?: LogoMode;
  /** 默认显示的图标路径 */
  defaultIconSrc?: string;
  /** hover 时显示的深色主题品牌图片路径 */
  hoverBrandDarkSrc?: string;
  /** hover 时显示的浅色主题品牌图片路径 */
  hoverBrandLightSrc?: string;
  /** 默认图标的尺寸 */
  defaultIconSize?: { width: number; height: number };
  /** hover 品牌图片的尺寸 */
  hoverBrandSize?: { width: number; height: number };
  /** 链接地址 */
  href?: string;
  /** 额外的 className */
  className?: string;
  /** 是否显示为链接 */
  asLink?: boolean;
  /** alt 文本 */
  alt?: string;
}

export default function Logo({
  mode = 'hover',
  defaultIconSrc = '/brand/logo.svg',
  hoverBrandDarkSrc = '/brand/brand_dark.svg',
  hoverBrandLightSrc = '/brand/brand_light.svg',
  defaultIconSize = { width: 26, height: 26 },
  hoverBrandSize = { width: 120, height: 26 },
  href = '/',
  className = '',
  asLink = true,
  alt = 'LOGO',
}: LogoProps) {
  const renderLogoIcon = () => (
    <Image
      src={defaultIconSrc}
      alt={alt}
      width={defaultIconSize.width}
      height={defaultIconSize.height}
    />
  );

  const renderBrandText = () => (
    <>
      <Image
        src={hoverBrandDarkSrc}
        alt={alt}
        width={hoverBrandSize.width}
        height={hoverBrandSize.height}
        className='block dark:hidden'
      />
      <Image
        src={hoverBrandLightSrc}
        alt={alt}
        width={hoverBrandSize.width}
        height={hoverBrandSize.height}
        className='hidden dark:block'
      />
    </>
  );

  const logoContent = (
    <motion.div
      layout
      className={`flex items-center p-2 transition-all duration-300 ${className}`}
    >
      {mode === 'logo' && (
        <div className='transition-all duration-300'>{renderLogoIcon()}</div>
      )}

      {mode === 'brand' && (
        <div className='transition-all duration-300'>{renderBrandText()}</div>
      )}

      {mode === 'hover' && (
        <>
          {/* 默认显示 logo */}
          <div className='transition-all duration-300 group-hover:hidden'>
            {renderLogoIcon()}
          </div>

          {/* hover 后显示 brand */}
          <div className='hidden transition-all duration-300 group-hover:block'>
            {renderBrandText()}
          </div>
        </>
      )}
    </motion.div>
  );

  if (asLink) {
    return (
      <Link href={href} className='no-underline'>
        {logoContent}
      </Link>
    );
  }

  return logoContent;
}
