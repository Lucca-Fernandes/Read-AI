import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true); // Novo estado de loading

    useEffect(() => {
        const currentToken = localStorage.getItem('token');
        if (currentToken) {
            try {
                const decoded = JSON.parse(atob(currentToken.split('.')[1]));
                setUser({ name: decoded.name, email: decoded.email, role: decoded.role });
                setToken(currentToken);
                // Configura o cabeçalho padrão do axios
                axios.defaults.headers.common['Authorization'] = `Bearer ${currentToken}`;
            } catch (error) {
                console.error("Token inválido, limpando:", error);
                localStorage.removeItem('token');
            }
        }
        setLoading(false); // Finaliza o loading após a verificação inicial
    }, []);

    const login = async (email, password) => {
        const response = await axios.post('http://localhost:3000/api/login', { email, password });
        const { token: newToken, user: newUser } = response.data;
        
        localStorage.setItem('token', newToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        setToken(newToken);
        setUser(newUser);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        delete axios.defaults.headers.common['Authorization'];
    };

    const value = { user, token, loading, login, logout };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};