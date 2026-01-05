import React, { useState, useEffect } from 'react';
import { 
    Box, 
    Typography, 
    Button, 
    Grid, 
    CircularProgress, 
    Container, 
    Paper,
    Divider,
    Avatar,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Chip
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import SentimentVerySatisfiedIcon from '@mui/icons-material/SentimentVerySatisfied';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AdminDurationChart from '../components/AdminDurationChart';
import AdminEngagementChart from '../components/AdminEngagementChart'; // Novo componente abaixo

const AdminPage = () => {
    const [loading, setLoading] = useState(true);
    const [agentsData, setAgentsData] = useState([]);
    const [summary, setSummary] = useState({ 
        total: 0, 
        avgEng: 0, 
        avgSent: 0 
    });
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/meetings`);
                const meetings = response.data;

                // Processamento de dados agrupados por Agente
                const stats = meetings.reduce((acc, meeting) => {
                    const agent = meeting.owner_name || 'Não Identificado';
                    const duration = parseFloat(meeting.duration_minutes) || 0;
                    const eng = parseFloat(meeting.engagement_score) || 0;
                    const sent = parseFloat(meeting.sentiment_score) || 0;

                    if (!acc[agent]) {
                        acc[agent] = { totalTime: 0, totalEng: 0, totalSent: 0, count: 0 };
                    }
                    acc[agent].totalTime += duration;
                    acc[agent].totalEng += eng;
                    acc[agent].totalSent += sent;
                    acc[agent].count += 1;
                    return acc;
                }, {});

                const formatted = Object.keys(stats).map(agent => ({
                    agent,
                    avgDuration: Math.round(stats[agent].totalTime / stats[agent].count),
                    avgEngagement: Math.round(stats[agent].totalEng / stats[agent].count),
                    avgSentiment: Math.round(stats[agent].totalSent / stats[agent].count),
                    count: stats[agent].count
                }));

                // Cálculo das médias gerais para os cards
                const totalEng = formatted.reduce((sum, item) => sum + item.avgEngagement, 0);
                const totalSent = formatted.reduce((sum, item) => sum + item.avgSentiment, 0);

                setAgentsData(formatted);
                setSummary({
                    total: meetings.length,
                    avgEng: Math.round(totalEng / formatted.length) || 0,
                    avgSent: Math.round(totalSent / formatted.length) || 0
                });
            } catch (error) {
                console.error("Erro ao carregar dados:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Rankings
    const topEngaged = [...agentsData].sort((a, b) => b.avgEngagement - a.avgEngagement).slice(0, 3);
    const bottomEngaged = [...agentsData].sort((a, b) => a.avgEngagement - b.avgEngagement).slice(0, 3);

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')} variant="outlined">
                        Voltar
                    </Button>
                    <Typography variant="h4" fontWeight="800" color="primary">BI & Gestão de Performance</Typography>
                </Box>
            </Box>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
            ) : (
                <Grid container spacing={3}>
                    {/* Cards de Resumo */}
                    <Grid item xs={12} md={4}>
                        <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 2, borderLeft: '6px solid #1976d2' }}>
                            <Typography variant="overline">Total de Monitorias</Typography>
                            <Typography variant="h3" fontWeight="bold">{summary.total}</Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 2, borderLeft: '6px solid #4caf50' }}>
                            <Typography variant="overline">Engajamento Médio dos Alunos</Typography>
                            <Typography variant="h3" fontWeight="bold" color="success.main">{summary.avgEng}%</Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 2, borderLeft: '6px solid #ff9800' }}>
                            <Typography variant="overline">Sentimento Médio</Typography>
                            <Typography variant="h3" fontWeight="bold" color="warning.main">{summary.avgSent}%</Typography>
                        </Paper>
                    </Grid>

                    {/* Gráfico de Duração (O que você pediu antes) */}
                    <Grid item xs={12} md={6}>
                        <AdminDurationChart data={agentsData} />
                    </Grid>

                    {/* Gráfico de Engajamento vs Sentimento */}
                    <Grid item xs={12} md={6}>
                        <AdminEngagementChart data={agentsData} />
                    </Grid>

                    {/* Rankings de Engajamento (Quantidade de fala do aluno) */}
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 3, borderRadius: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                <TrendingUpIcon color="success" />
                                <Typography variant="h6" fontWeight="bold">Top 3: Alunos mais Engajados</Typography>
                            </Box>
                            <List>
                                {topEngaged.map((item, index) => (
                                    <ListItem key={index} divider={index !== 2}>
                                        <ListItemAvatar>
                                            <Avatar sx={{ bgcolor: 'success.light' }}><RecordVoiceOverIcon /></Avatar>
                                        </ListItemAvatar>
                                        <ListItemText primary={item.agent} secondary={`${item.count} reuniões analisadas`} />
                                        <Chip label={`${item.avgEngagement}% engajamento`} color="success" variant="outlined" />
                                    </ListItem>
                                ))}
                            </List>
                        </Paper>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 3, borderRadius: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                <TrendingDownIcon color="error" />
                                <Typography variant="h6" fontWeight="bold">Alerta: Menor Engajamento de Alunos</Typography>
                            </Box>
                            <List>
                                {bottomEngaged.map((item, index) => (
                                    <ListItem key={index} divider={index !== 2}>
                                        <ListItemAvatar>
                                            <Avatar sx={{ bgcolor: 'error.light' }}><SentimentVerySatisfiedIcon /></Avatar>
                                        </ListItemAvatar>
                                        <ListItemText primary={item.agent} secondary={`${item.count} reuniões analisadas`} />
                                        <Chip label={`${item.avgEngagement}% engajamento`} color="error" variant="outlined" />
                                    </ListItem>
                                ))}
                            </List>
                        </Paper>
                    </Grid>
                </Grid>
            )}
        </Container>
    );
};

export default AdminPage;