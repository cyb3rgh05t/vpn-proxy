import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-vpn-bg">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-vpn-bg">
        <Outlet />
      </main>
    </div>
  );
}
