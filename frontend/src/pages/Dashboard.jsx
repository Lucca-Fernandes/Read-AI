import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Grid,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Button,
  Tooltip,
  Fade,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import InsightsIcon from '@mui/icons-material/Insights';
import axios from 'axios';
import { format } from 'date-fns';
import MeetingCard from '../components/MeetingCard';
import Filters from '../components/Filters';
import DashboardChart from '../components/DashboardChart';
import { useAuth } from '../context/AuthContext';

// --- LÓGICA DE CÁLCULO DA NOTA (MESMA FUNÇÃO DO MeetingCard) ---
const getCalculatedScore = (evaluationText) => {
    if (!evaluationText || typeof evaluationText !== 'string') return -1;
    
    const lines = evaluationText.split('\n');
    let totalAwarded = 0;
    let totalMax = 0;

    lines.forEach(line => {
        const match = line.match(/-\s(.*?):\s*(-?\d+)\/(\d+)/);
        if (match) {
            const awarded = parseInt(match[2], 10);
            const max = parseInt(match[3], 10);
            if (!isNaN(awarded) && !isNaN(max) && max > 0) {
                totalAwarded += awarded;
                totalMax += max;
            }
        }
    });

    if (totalMax === 0) return -1;

    return Math.round((totalAwarded / totalMax) * 100);
};


const Dashboard = () => {
  const { user, logout, token } = useAuth();
  const [originalMeetings, setOriginalMeetings] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [filter, setFilter] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [chartData, setChartData] = useState([]);

  const fetchMeetings = useCallback(async (start, end) => {
    setLoading(true);
    try {
      let url = `${import.meta.env.VITE_API_URL}/api/meetings`;
      
      const params = {};
      if (start) params.startDate = format(start, 'yyyy-MM-dd');
      if (end) params.endDate = format(end, 'yyyy-MM-dd');
      
      const response = await axios.get(url, { 
        headers: { 'Authorization': `Bearer ${token}` },
        params 
      });

      setOriginalMeetings(response.data);
      setMeetings(response.data);
    } catch (err) {
      console.error("Erro ao buscar reuniões:", err);
      if (err.response?.status === 403) {
        setError('Sua sessão expirou. Por favor, faça o login novamente.');
        setTimeout(logout, 3000);
      } else {
        setError('Falha ao carregar as reuniões. Tente atualizar a página.');
      }
    } finally {
      setLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    fetchMeetings(startDate, endDate);
  }, [fetchMeetings, startDate, endDate]);

  const applyFiltersAndCalculateChartData = useCallback(() => {
    let filtered = [...originalMeetings];

    // Lógica de ordenação e filtro
    if (filter !== 'all') {
      filtered.sort((a, b) => {
        const scoreA = getCalculatedScore(a.evaluation_text);
        const scoreB = getCalculatedScore(b.evaluation_text);
        return filter === 'highest' ? scoreB - scoreA : scoreA - scoreB;
      });
    }

    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      filtered = filtered.filter(m =>
        m.meeting_title?.toLowerCase().includes(lowerKeyword) ||
        m.owner_name?.toLowerCase().includes(lowerKeyword) ||
        m.summary?.toLowerCase().includes(lowerKeyword)
      );
    }

    setMeetings(filtered);

    // Lógica para calcular os dados do gráfico
    const calculateChartData = (meetingsToProcess) => {
      const scoresByMonitor = meetingsToProcess.reduce((acc, meeting) => {
        const score = getCalculatedScore(meeting.evaluation_text);
        if (meeting.owner_name && score !== -1) {
          if (!acc[meeting.owner_name]) {
            acc[meeting.owner_name] = { totalScore: 0, count: 0 };
          }
          acc[meeting.owner_name].totalScore += score;
          acc[meeting.owner_name].count++;
        }
        return acc;
      }, {});

      const data = Object.entries(scoresByMonitor)
        .filter(([, data]) => data.count >= 2)
        .map(([monitor, data]) => ({
          monitor,
          average: Math.round(data.totalScore / data.count),
        }))
        .sort((a, b) => b.average - a.average);

      setChartData(data);
    };

    calculateChartData(originalMeetings);
  }, [originalMeetings, filter, keyword]);

  useEffect(() => {
    applyFiltersAndCalculateChartData();
  }, [applyFiltersAndCalculateChartData]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/refresh-meetings`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await fetchMeetings(startDate, endDate);
    } catch (err) {
      console.error("Erro ao atualizar reuniões:", err);
      setError('Falha ao buscar novas reuniões.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <InsightsIcon sx={{ fontSize: '2.5rem', color: 'primary.main', mr: 1.5 }} />
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Dashboard de Análise de Reuniões</Typography>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Filters
          filter={filter} setFilter={setFilter}
          keyword={keyword} setKeyword={setKeyword}
          startDate={startDate} setStartDate={setStartDate}
          endDate={endDate} setEndDate={setEndDate}
          onDateFilter={(start, end) => { setStartDate(start); setEndDate(end); }}
        />
        <Box mt={2} display="flex" justifyContent="flex-end">
            <Tooltip title="Recarregar e avaliar novas reuniões">
              <Button
                variant="contained" color="secondary" onClick={handleRefresh}
                startIcon={<RefreshIcon />} sx={{ height: '56px' }} disabled={loading}
              >
                {loading ? 'Atualizando...' : 'Atualizar'}
              </Button>
            </Tooltip>
        </Box>
      </Box>

      <Fade in={chartData.length > 0} timeout={800}>
        <Box mb={5}>
          <DashboardChart chartData={chartData} />
        </Box>
      </Fade>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {loading && meetings.length === 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 5 }}>
          <CircularProgress color="secondary" sx={{ mb: 2 }} />
          <Typography>Carregando reuniões...</Typography>
        </Box>
      ) : meetings.length === 0 && !error ? (
        <Typography sx={{ textAlign: 'center', my: 5 }}>
          Nenhuma reunião encontrada com os filtros aplicados.
        </Typography>
      ) : (
        <Grid container spacing={3}>
          {meetings.map((meeting) => (
            <Grid item key={meeting.id} xs={12} sm={6} md={4}>
              <MeetingCard meeting={meeting} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default Dashboard;