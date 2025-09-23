import React, { useState, useEffect, useCallback } from 'react';
import {
  Grid, Typography, Box, CircularProgress, Alert, Button, Tooltip, Fade,
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

  const fetchMeetings = useCallback(async (start, end) => {
    setLoading(true);
    try {
      // Usa variável de ambiente para a URL da API em produção
      let url = `${import.meta.env.VITE_API_URL}/api/meetings`;
      
      const params = {};
      if (start) params.startDate = format(start, 'yyyy-MM-dd');
      if (end) params.endDate = format(end, 'yyyy-MM-dd');
      
      const response = await axios.get(url, { 
        params,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const formattedMeetings = response.data.map(meeting => ({
          ...meeting,
          // Garante que a prop esperada pelo MeetingCard exista
          evaluationText: meeting.evaluation_text 
      }));

      setOriginalMeetings(formattedMeetings);
      setError(null);
    } catch (err) {
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        logout();
      } else {
        setError(`Falha ao carregar reuniões: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [logout, token]);

  useEffect(() => {
    if (token) { // Só busca as reuniões se o token já estiver disponível
        fetchMeetings(startDate, endDate);
    }
  }, [startDate, endDate, fetchMeetings, token]);

  const handleSetDateRange = (start, end) => {
    setStartDate(start);
    setEndDate(end);
  };

  useEffect(() => {
    let processedMeetings = [...originalMeetings];
    if (keyword.trim() !== '') {
      const lowerCaseKeyword = keyword.toLowerCase();
      processedMeetings = processedMeetings.filter(meeting =>
        (meeting.meeting_title || '').toLowerCase().includes(lowerCaseKeyword) ||
        (meeting.owner_name || '').toLowerCase().includes(lowerCaseKeyword)
      );
    }
    if (filter === 'not_conducted') {
      processedMeetings = processedMeetings.filter(m => m.score === 0);
    } else if (filter === 'failed') {
      processedMeetings = processedMeetings.filter(m => m.score === -1);
    } else {
      processedMeetings = processedMeetings.filter(m => m.score > 0);
      if (filter === 'score_desc') {
        processedMeetings.sort((a, b) => b.score - a.score);
      } else if (filter === 'score_asc') {
        processedMeetings.sort((a, b) => a.score - b.score);
      }
    }
    setMeetings(processedMeetings);
  }, [filter, keyword, originalMeetings]);

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
      .filter(monitor => monitor.count >= 2)
      .sort((a, b) => b.average - a.average);
    setChartData(monitorAverages);
  }, [originalMeetings]);

  const handleTitleClick = () => {
    setFilter('all');
    setKeyword('');
    handleSetDateRange(null, null);
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/update`, {}, {
          headers: { 'Authorization': `Bearer ${token}` }
      });
      await fetchMeetings(startDate, endDate); 
      setError(null);
    } catch (err) {
       if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        logout();
      } else {
        setError(`Falha ao atualizar as reuniões: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: 1600, mx: 'auto' }}>
        {/* ... O restante do JSX permanece o mesmo */}
    </Box>
  );
};

export default Dashboard;