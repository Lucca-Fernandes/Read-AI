import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Box, 
    TextField, 
    Button, 
    Typography, 
    Container, 
    Paper, 
    Alert,
    Snackbar
} from '@mui/material';
import InsightsIcon from '@mui/icons-material/Insights';
import axios from 'axios';

const ResetPasswordPage = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [snackbar, setSnackbar] = useState({ open: false, message: '' });
    const { token } = useParams();
    const navigate = useNavigate();

    const handleCloseSnackbar = () => setSnackbar({ ...snackbar, open: false });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

          try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/reset-password/${token}`, { password });
            setSnackbar({ open: true, message: response.data.message + ' Você será redirecionado para o login.' });
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Não foi possível redefinir a senha.');
        }
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
                            Redefinir Senha
                        </Typography>
                    </Box>
                    
                    <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%', mt: 1 }}>
                        <TextField 
                            margin="normal" required fullWidth 
                            label="Nova Senha" type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            autoFocus
                        />
                        <TextField 
                            margin="normal" required fullWidth 
                            label="Confirmar Nova Senha" type="password" 
                            value={confirmPassword} 
                            onChange={(e) => setConfirmPassword(e.target.value)} 
                        />
                        
                        {error && <Alert severity="error" sx={{ width: '100%', mt: 2 }}>{error}</Alert>}

                        <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2, py: 1.5 }} disabled={snackbar.open}>
                            Salvar Nova Senha
                        </Button>
                    </Box>
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

export default ResetPasswordPage;