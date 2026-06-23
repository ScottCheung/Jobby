/** @format */

// components/ProductItem.tsx

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

const ProductItem = ({
  title,
  description,
  href,
  src,
}: {
  title: string;
  description: string;
  href: string;
  src: string;
}) => {
  return (
    <Link href={href} className='flex space-x-6 group'>
      <div className='rounded-md flex-shrink-0  shadow-2xl overflow-hidden '>
        <Image
          src={src}
          width={130}
          height={60}
          alt={title}
          className='transition-all ease-in-out duration-500 group-hover:scale-125'
        />
      </div>
      <div className=' transition-all ease-in-out duration-500 group-hover:translate-x-1'>
        <h4 className='font-bold text-xl text-black mb-1 darkk:text-white'>
          {title}
        </h4>
        <p className='text-sm max-w-[10rem] opacity-50 transition-all text-neutral-700 darkk:text-white group-hover:opacity-100'>
          {description}
        </p>
      </div>
    </Link>
  );
};

export default ProductItem;
