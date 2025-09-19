import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import ResetPasswordPage from './pages/ResetPasswordPage';
import { CircularProgress, Box } from '@mui/material';

function AppContent() {
    const { token, loading } = useAuth();

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Routes>
            <Route path="/login" element={!token ? <AuthPage /> : <Navigate to="/" />} />
            <Route path="/reset-password/:token" element={!token ? <ResetPasswordPage /> : <Navigate to="/" />} />
            <Route path="/" element={token ? <Dashboard /> : <Navigate to="/login" />} />
            <Route path="*" element={<Navigate to={token ? "/" : "/login"} />} />
        </Routes>
    );
}

function App() {
    return (
        <Router>
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </Router>
    );
}

export default App;