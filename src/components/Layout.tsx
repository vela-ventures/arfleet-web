import React from 'react';

import './Layout.css'

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="app-container">
      {children}
    </div>
  );
};

export default Layout;