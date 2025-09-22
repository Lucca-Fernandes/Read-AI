import React, { useState } from 'react';
import { 
    Box, 
    TextField, 
    Button, 
    Typography, 
    Container, 
    Paper, 
    Tabs, 
    Tab, 
    Alert,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Link,
    Snackbar
} from '@mui/material';
import InsightsIcon from '@mui/icons-material/Insights';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const monitorNames = [
    "Alex Fonseca",
    "Eduardo Cotta Perdigão Pontes",
    "Ingrid Picorelle",
    "Natanael Hauck",
    "Douglas Freitas",
    "Isabela Jales",
    "Lucas Fernandes Garcia",
    "Pedro Resende",
    "Talita Linhares"
    // Adicione outros nomes de monitores aqui
];

const AuthPage = () => {
    const [view, setView] = useState('login'); // 'login', 'register', 'forgot'
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [snackbar, setSnackbar] = useState({ open: false, message: '' });
    const { login } = useAuth();

    const handleCloseSnackbar = () => setSnackbar({ ...snackbar, open: false });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if (view === 'login') {
            try {
                await login(email, password);
            } catch (err) {
                setError('Falha no login. Verifique suas credenciais.');
            }
        } else if (view === 'register') {
            if (!name) {
                setError('Por favor, selecione seu nome na lista.');
                return;
            }
            try {
                await axios.post(`${import.meta.env.VITE_API_URL}/api/register`, { name, email, password });
                setSnackbar({ open: true, message: 'Usuário registrado com sucesso! Faça o login.' });
                setView('login');
                setName('');
                setEmail('');
                setPassword('');
            } catch (err) {
                setError(err.response?.data?.error || 'Falha no registro.');
            }
        }
    };

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/forgot-password`, { email });
            setSnackbar({ open: true, message: 'Se houver uma conta com este email, um link foi enviado.' });
            setView('login');
        } catch (err) {
            setError('Não foi possível enviar o email. Tente novamente.');
        }
    };

    const renderMainContent = () => {
        if (view === 'forgot') {
            return (
                <Box component="form" onSubmit={handleForgotPassword} sx={{ width: '100%', mt: 1 }}>
                    <Typography sx={{ mb: 2, textAlign: 'center', color: 'text.secondary' }}>
                        Digite seu email para receber o link de redefinição.
                    </Typography>
                    <TextField 
                        margin="normal" 
                        required 
                        fullWidth 
                        label="Endereço de Email" 
                        type="email" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        autoFocus 
                    />
                    <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2, py: 1.5 }}>
                        Enviar Link de Redefinição
                    </Button>
                    <Link href="#" onClick={() => { setView('login'); setError(''); }} variant="body2" sx={{ display: 'block', textAlign: 'center' }}>
                        Lembrou a senha? Voltar para o Login
                    </Link>
                </Box>
            );
        }

        return (
            <>
                <Tabs value={view === 'login' ? 0 : 1} onChange={(e, val) => setView(val === 0 ? 'login' : 'register')} centered sx={{ mb: 2 }} variant="fullWidth">
                    <Tab label="Login" />
                    <Tab label="Registrar" />
                </Tabs>
                <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%', mt: 1 }}>
                    {view === 'register' && (
                        <FormControl fullWidth margin="normal" required>
                            <InputLabel id="monitor-name-select-label">Selecione seu Nome</InputLabel>
                            <Select
                                labelId="monitor-name-select-label"
                                value={name}
                                label="Selecione seu Nome"
                                onChange={(e) => setName(e.target.value)}
                            >
                                <MenuItem value="" disabled><em>-- Selecione um nome --</em></MenuItem>
                                {monitorNames.sort().map((monitorName) => (
                                    <MenuItem key={monitorName} value={monitorName}>{monitorName}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}
                    <TextField 
                        margin="normal" required fullWidth 
                        label="Endereço de Email" type="email" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        autoFocus={view === 'login'}
                    />
                    <TextField 
                        margin="normal" required fullWidth 
                        label="Senha" type="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                    />
                    {view === 'login' && (
                        <Link href="#" onClick={() => { setView('forgot'); setError(''); }} variant="body2" sx={{ mt: 1, display: 'block', textAlign: 'right' }}>
                            Esqueceu a senha?
                        </Link>
                    )}
                    {error && <Alert severity="error" sx={{ width: '100%', mt: 2 }}>{error}</Alert>}
                    <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2, py: 1.5 }}>
                        {view === 'login' ? 'Entrar' : 'Registrar'}
                    </Button>
                </Box>
            </>
        );
    };

    return (
        <Box 
            sx={{
                minHeight: '100vh', display: 'flex', flexDirection: 'column', 
                justifyContent: 'center', alignItems: 'center',
                background: 'linear-gradient(to top, #f3e5f5, #e1f5fe)', p: 2
            }}
        >
            <Container component="main" maxWidth="xs">
                <Paper 
                    elevation={8} 
                    sx={{ p: { xs: 3, sm: 4 }, display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: 4 }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 3 }}>
                        <InsightsIcon sx={{ fontSize: '2.8rem', color: 'primary.main' }} />
                        <Typography 
                            variant="h4" component="h1" 
                            sx={{
                                fontWeight: 700,
                                background: (theme) => `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent'
                            }}
                        >
                            Painel de Análises
                        </Typography>
                    </Box>
                    {renderMainContent()}
                </Paper>
            </Container>
            <Snackbar 
                open={snackbar.open} 
                autoHideDuration={6000} 
                onClose={handleCloseSnackbar} 
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleCloseSnackbar} severity="success" sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default AuthPage;