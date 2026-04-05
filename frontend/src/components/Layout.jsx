import { useRef, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function Layout() {
  const mainRef = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo(0, 0);
    }
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-vpn-bg">
      <Sidebar />
      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto p-4 pt-16 sm:p-6 sm:pt-6 lg:p-8 bg-vpn-bg"
      >
        <Outlet />
      </main>
    </div>
  );
}
