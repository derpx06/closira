import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import Navbar from '../components/common/Navbar';

const DashboardLayout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 antialiased font-sans">
      
      {/* Sidebar Component orchestrates both Desktop Fixed and Mobile Canvas positioning natively */}
      <Sidebar 
        isMobileOpen={isMobileMenuOpen} 
        setMobileOpen={setIsMobileMenuOpen} 
      />

      {/* Primary Viewport Pane */}
      <div className="flex flex-col flex-1 w-full overflow-hidden">
        
        {/* Horizontal Navbar wrapper rendering User state */}
        <Navbar toggleMobileMenu={toggleMobileMenu} />

        {/* Content Render Area utilizing standard scrolling and container mapping */}
        <main className="soft-scrollbar flex-1 overflow-y-auto focus:outline-none scroll-smooth">
          <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
             {/* Sub-pages resolve here seamlessly without bleeding constraints */}
             <Outlet />
          </div>
        </main>

      </div>
      
    </div>
  );
};

export default DashboardLayout;
