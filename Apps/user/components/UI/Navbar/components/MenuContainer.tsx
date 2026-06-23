// components/Menu.tsx

import React from "react";

const Menu = ({
  setActive,
  children,
}: {
  setActive: (item: string | null) => void;
  children: React.ReactNode;
}) => {
  return (
    <nav
      onMouseLeave={() => setActive(null)}
      className="flex space-x-4 shadow-input -m-2 py-2 relative justify-center items-center"
    >
      {children}
    </nav>
  );
};

export default Menu;
