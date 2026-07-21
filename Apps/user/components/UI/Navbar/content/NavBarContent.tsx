/** @format */

// components/Menubar.tsx

import React, { useState } from 'react';
import Menu from '../components/MenuContainer';
import { motion } from 'framer-motion';
import MenuItem from '../components/MenuItem';
import ProductItem from '../components/ProductItem';
import HoveredLink from '../components/HoveredLink';

const Menubar = () => {
  const [active, setActive] = useState<string | null>(null);
  return (
    <motion.div className='hidden md:flex '>
      <Menu setActive={setActive}>
        <MenuItem setActive={setActive} active={active} item='Services'>
          <div className='body-md flex flex-col space-y-4'>
            <HoveredLink href='/hobby'>Zodiac Forecast</HoveredLink>
            <HoveredLink href='/individual'>Lucky Colors</HoveredLink>
            <HoveredLink href='/individual'>AI Recommendations</HoveredLink>
            <HoveredLink href='/team'>Lucky Fragrance Elements</HoveredLink>
            <HoveredLink href='/enterprise'>Membership Benefits</HoveredLink>
          </div>
        </MenuItem>
        <MenuItem setActive={setActive} active={active} item='Products'>
          <div className='col  p-4 '>
            <div className='body-md max-h-[80vh] grid gap-10 overflow-visible lg:grid-cols-2'>
              <ProductItem
                title="Men's Fragrances"
                href='/mens-fragrances'
                src='/graph/navbar/male.jpg'
                description="Discover our collection of men's fragrances, crafted for sophistication and elegance. "
              />
              <ProductItem
                title="Women's Fragrances"
                href='/womens-fragrances'
                src='/graph/navbar/female.jpg'
                description="Explore our range of women's fragrances, created to inspire confidence and charm."
              />
              <ProductItem
                title='Non-Binary Fragrances'
                href='/non-binary-fragrances'
                src='/graph/navbar/lgbt.jpg'
                description='Experience scents that transcend traditional categories. Embrace self-expression beyond gender. '
              />
              <ProductItem
                title='Brands Fragrances'
                href='/luxury-brands'
                src='/graph/navbar/luxury.jpg'
                description='Indulge in the world of luxury fragrances from top brands worldwide.'
              />
            </div>
            <div className='body-sm bg-transparent mt-10 text-muted'>
              We honor gender equality and diverse gender identities. Fragrances
              have no inherent gender; our categories simply aim to help you
              find the perfect scent with ease.
            </div>
          </div>
        </MenuItem>
        <MenuItem setActive={setActive} active={active} item='Rank'>
          <div className='body-md flex flex-col space-y-4'>
            <HoveredLink href='/hobby'>Sillage Duration</HoveredLink>
            <HoveredLink href='/individual'>By Fragrance</HoveredLink>
            <HoveredLink href='/team'>By Fragrance Elements</HoveredLink>
            <HoveredLink href='/enterprise'>By Overall Rating</HoveredLink>
          </div>
        </MenuItem>
      </Menu>
    </motion.div>
  );
};

export default Menubar;
