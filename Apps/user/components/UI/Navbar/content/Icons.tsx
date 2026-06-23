"use client";
import React, { useState } from "react";
import Menu from "../components/MenuContainer";
import MenuItem from "../components/MenuItem";
import ProductItem from "../components/ProductItem";
import HoveredLink from "../components/HoveredLink";


  

  const MenuIcons = () =>
  {
      const [active, setActive] = useState<string | null>(null);
    return (
          <Menu setActive={setActive}>
        <MenuItem setActive={ setActive } active={ active } item={ "<i class='flex fi fi-rs-search'></i>" } type={'tag'}>
        <div className="flex flex-col text-sm ">
Search
        </div>
        </MenuItem>
                <MenuItem setActive={ setActive } active={ active } item={ "<i class='flex fi fi-rr-user'></i>" } type={'tag'}>
        <div className="flex flex-col text-sm">
User Center
        </div>
      </MenuItem>
              <MenuItem setActive={ setActive } active={ active } item={ "<i class='flex fi fi-rr-shopping-cart'></i>" } type={'tag'}>
        <div className="flex flex-col text-sm">
Cart
        </div>
      </MenuItem>

    </Menu>
    );
  };





export default MenuIcons;