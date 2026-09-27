import React, { useState, useEffect } from 'react';

/**
 * Site-wide Portal Footer
 * Specifications:
 * - Line 1: © 2026 CS-BYC. All rights reserved.
 * - Line 2: Ideated and Developed by: Dr Balakrishnan C & Dr Vinay M | CS-BYC
 * - Styling: Navy #1f3864, thin gold #b8963e border-t, 12-13px text, WCAG AA compliant.
 * - Hides in projector / fullscreen mode.
 * - Print view shows only line 1 in small grey text.
 */
export const Footer: React.FC = () => {
  const [isProjectorActive, setIsProjectorActive] = useState<boolean>(false);

  useEffect(() => {
    const checkProjector = () => {
      const hasProjectorElement = Boolean(document.getElementById('projector-mode-view'));
      const isFullscreen = Boolean(document.fullscreenElement);
      setIsProjectorActive(hasProjectorElement || isFullscreen);
    };

    checkProjector();
    const interval = setInterval(checkProjector, 500);
    document.addEventListener('fullscreenchange', checkProjector);

    return () => {
      clearInterval(interval);
      document.removeEventListener('fullscreenchange', checkProjector);
    };
  }, []);

  if (isProjectorActive) return null;

  return (
    <footer
      role="contentinfo"
      id="site-portal-footer"
      className="bg-[#1f3864] text-white border-t border-[#b8963e] py-3.5 px-4 w-full shrink-0 print:bg-transparent print:border-none print:py-2"
    >
      <div className="max-w-7xl mx-auto text-center space-y-1">
        <p className="text-[12px] sm:text-[13px] text-gray-200 print:text-[10px] print:text-gray-500 font-normal leading-tight">
          © 2026 CS-BYC. All rights reserved.
        </p>
        <p className="text-[12px] sm:text-[13px] text-gray-300 print:hidden font-normal leading-tight">
          Ideated and Developed by: Dr Balakrishnan C & Dr Vinay M | CS-BYC
        </p>
      </div>
    </footer>
  );
};
