import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthPage from '../pages/AuthPage';
import Dashboard from '../pages/Dashboard';
import AdminPage from '../pages/AdminPage'; 
import ResetPasswordPage from '../pages/ResetPasswordPage';

// Componente para proteger rotas de Admin
const AdminRoute = ({ children }) => {
    const { user, token, loading } = useAuth();

    if (loading) return null;

    // Verifica se está logado E se a role é 'admin'
    if (!token || user?.role !== 'admin') {
        return <Navigate to="/" replace />;
    }

    return children;
};

export function AppRoutes() {
    const { token } = useAuth();

    return (
        <Routes>
            {/* Rotas Públicas */}
            <Route 
                path="/login" 
                element={!token ? <AuthPage /> : <Navigate to="/" />} 
            />
            <Route 
                path="/reset-password/:token" 
                element={!token ? <ResetPasswordPage /> : <Navigate to="/" />} 
            />

            {/* Rotas Protegidas (Logado) */}
            <Route 
                path="/" 
                element={token ? <Dashboard /> : <Navigate to="/login" />} 
            />

            {/* Rota Exclusiva Admin */}
            <Route
                path="/admin"
                element={
                    <AdminRoute>
                        <AdminPage />
                    </AdminRoute>
                }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to={token ? "/" : "/login"} />} />
        </Routes>
    );
}