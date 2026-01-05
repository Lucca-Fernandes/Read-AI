import React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import AnalyticsIcon from '@mui/icons-material/Analytics';

const AdminEngagementChart = ({ data }) => {
  if (!data || data.length === 0) return null;

  const agents = data.map(d => d.agent);
  const engagement = data.map(d => d.avgEngagement);
  const sentiment = data.map(d => d.avgSentiment);

  return (
    <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <AnalyticsIcon color="secondary" />
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Engajamento vs Sentimento do Aluno</Typography>
      </Box>
      <Box sx={{ height: 400, width: '100%' }}>
        <BarChart
          series={[
            { data: engagement, label: 'Engajamento %', color: '#4caf50' },
            { data: sentiment, label: 'Sentimento %', color: '#ff9800' }
          ]}
          xAxis={[{ data: agents, scaleType: 'band' }]}
          height={350}
        />
      </Box>
    </Paper>
  );
};

export default AdminEngagementChart;