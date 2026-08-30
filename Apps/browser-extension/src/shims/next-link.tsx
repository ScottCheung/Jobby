import React from 'react';

export function Link({
  href = '#',
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href?: string }) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}

export default Link;
