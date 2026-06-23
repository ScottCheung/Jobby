/** @format */

// components/HoveredLink.tsx

import React from 'react';
import Link from 'next/link';

const HoveredLink = ({ children, ...rest }: any) => {
  return (
    <Link
      {...rest}
      className='text-neutral-700 darkk:text-neutral-200 hover:text-black'
    >
      {children}
    </Link>
  );
};

export default HoveredLink;
