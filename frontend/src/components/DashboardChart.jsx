import React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';

const getBarColor = (score) => {
  if (score >= 80) return '#4caf50';
  if (score > 50) return '#1976d2';
  return '#f44336';
};

const DashboardChart = ({ chartData }) => {
  if (!chartData || chartData.length === 0) {
    return (
      <Paper elevation={3} sx={{ p: 3, borderRadius: 2, textAlign: 'center' }}>
        <Typography>Não há dados suficientes para exibir o gráfico de desempenho.</Typography>
        <Typography variant="caption">É necessário que os monitores tenham pelo menos 2 avaliações.</Typography>
      </Paper>
    );
  }

  const seriesData = chartData.map(item => item.average);
  const xLabels = chartData.map(item => item.monitor);
  const colors = chartData.map(item => getBarColor(item.average));

  return (
    <Paper elevation={3} sx={{ p: { xs: 1, sm: 2 }, borderRadius: 2, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, ml: 2 }}>
        <LeaderboardIcon color="primary" />
        <Typography variant="h6" component="h3" sx={{ fontWeight: 'bold' }}>
          Média de Desempenho por Monitor
        </Typography>
      </Box>
      <Box sx={{ height: 350, width: '100%' }}>
        <BarChart
          series={[{ data: seriesData, label: 'Média de Nota' }]}
          xAxis={[{
            data: xLabels,
            scaleType: 'band',
            tickLabelStyle: {
              angle: -45,
              textAnchor: 'end',
              fontSize: 12,
            }
          }]}
          yAxis={[{ label: 'Média' }]}
          colors={colors}
          legend={{ hidden: true }}
          grid={{ horizontal: true }}
          sx={{
            width: '100%',
            '.MuiChartsAxis-bottom .MuiChartsAxis-tickContainer': {
              transform: 'translateY(10px)',
            }
          }}
        />
      </Box>
    </Paper>
  );
};

export default DashboardChart;