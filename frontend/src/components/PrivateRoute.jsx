import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ContainerDataProvider } from "../context/ContainerDataContext";

export default function PrivateRoute() {
  const { user, loading } = useAuth();

  if (loading) return null;
  return user ? (
    <ContainerDataProvider>
      <Outlet />
    </ContainerDataProvider>
  ) : (
    <Navigate to="/login" />
  );
}
