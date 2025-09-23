import React, { useState, useEffect, useCallback } from 'react';
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

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/meetings`, {
          headers: { Authorization: `Bearer ${token}` }
      });
      const formattedMeetings = response.data.map(meeting => ({
        ...meeting,
        evaluationText: meeting.evaluation_text 
      }));
      setOriginalMeetings(formattedMeetings);
    } catch (err) {
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        logout();
      } else {
        setError(`Falha ao carregar reuniões: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const applyFilters = useCallback(() => {
    let processedMeetings = [...originalMeetings];

    // Filtro por data
    if (startDate && endDate) {
        processedMeetings = processedMeetings.filter(m => {
            const meetingDate = new Date(m.start_time);
            return meetingDate >= startDate && meetingDate <= endDate;
        });
    }

    // Filtro por palavra-chave
    if (keyword.trim() !== '') {
      const lowerCaseKeyword = keyword.toLowerCase();
      processedMeetings = processedMeetings.filter(meeting =>
        (meeting.meeting_title || '').toLowerCase().includes(lowerCaseKeyword) ||
        (meeting.owner_name || '').toLowerCase().includes(lowerCaseKeyword)
      );
    }

    // Filtro de status e ordenação
    if (filter === 'not_conducted') {
      processedMeetings = processedMeetings.filter(m => m.score === 0 || m.score === -1);
    } else {
      processedMeetings = processedMeetings.filter(m => m.score > 0);
      if (filter === 'score_desc') {
        processedMeetings.sort((a, b) => b.score - a.score);
      } else if (filter === 'score_asc') {
        processedMeetings.sort((a, b) => a.score - b.score);
      }
    }

    setMeetings(processedMeetings);
  }, [originalMeetings, startDate, endDate, keyword, filter]);


  useEffect(() => {
    applyFilters();
  }, [applyFilters]);
  

  useEffect(() => {
    if (originalMeetings.length === 0) return;
    const validMeetings = originalMeetings.filter(m => m.score > 0);
    const monitorStats = validMeetings.reduce((acc, meeting) => {
      const monitorName = meeting.owner_name;
      if (!acc[monitorName]) {
        acc[monitorName] = { totalScore: 0, count: 0 };
      }
      acc[monitorName].totalScore += meeting.score;
      acc[monitorName].count++;
      return acc;
    }, {});
    const monitorAverages = Object.keys(monitorStats)
      .map(name => ({
        monitor: name,
        average: Math.round(monitorStats[name].totalScore / monitorStats[name].count),
        count: monitorStats[name].count,
      }))
      .filter(monitor => monitor.count >= 2) // O gráfico só aparece se o monitor tiver 2 ou mais reuniões
      .sort((a, b) => b.average - a.average);
    setChartData(monitorAverages);
  }, [originalMeetings]);

  const handleTitleClick = () => {
    setFilter('all');
    setKeyword('');
    setStartDate(null);
    setEndDate(null);
  };

  // 👇 CORREÇÃO APLICADA AQUI 👇
  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      // Alterado de POST /api/update para GET /api/refresh-meetings
      await axios.get(`${import.meta.env.VITE_API_URL}/api/refresh-meetings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Após atualizar, buscamos a lista completa novamente
      await fetchMeetings(); 
    } catch (err) {
       if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        logout();
       } else {
         setError(`Falha ao atualizar as reuniões: ${err.response ? err.response.data.error : err.message}`);
       }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: 1600, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h6">
            Bem-vindo(a), <strong>{user?.name}</strong>
          </Typography>
          <Button variant="outlined" color="secondary" onClick={logout}>
            Sair
          </Button>
      </Box>

      <Fade in timeout={800}>
        <Tooltip title="Clique para resetar os filtros" arrow placement="bottom">
          <Box
            onClick={handleTitleClick}
            sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 1, sm: 2 },
              mb: 5, cursor: 'pointer', '&:hover': { transform: 'scale(1.025)' }
            }}
          >
            <InsightsIcon sx={{ fontSize: { xs: '2.5rem', sm: '3.5rem' }, color: 'primary.main' }} />
            <Typography
              variant="h3" component="h1"
              sx={{
                fontWeight: 800,
                background: (theme) => `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
              }}
            >
              Painel de Análises
            </Typography>
          </Box>
        </Tooltip>
      </Fade>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            <Box sx={{ flexGrow: 1 }}>
              <Filters
                filter={filter}
                setFilter={setFilter}
                keyword={keyword}
                setKeyword={setKeyword}
                startDate={startDate}
                setStartDate={setStartDate}
                endDate={endDate}
                setEndDate={setEndDate}
              />
            </Box>
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
            <Grid item key={meeting.session_id} xs={12} sm={6} md={4}>
              <MeetingCard meeting={meeting} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default Dashboard;
