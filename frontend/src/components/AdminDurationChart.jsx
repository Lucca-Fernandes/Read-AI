import React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

const AdminDurationChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <Paper elevation={3} sx={{ p: 3, textAlign: 'center', borderRadius: 2 }}>
        <Typography>Sem dados de duração disponíveis.</Typography>
      </Paper>
    );
  }

  // Ordenar do agente com reuniões mais longas para as mais curtas
  const sortedData = [...data].sort((a, b) => b.avgDuration - a.avgDuration);
  
  const durations = sortedData.map(item => item.avgDuration);
  const agents = sortedData.map(item => item.agent);

  return (
    <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <AccessTimeIcon color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          Duração Média de Monitoria por Agente
        </Typography>
      </Box>
      
      <Box sx={{ height: 400, width: '100%' }}>
        <BarChart
          series={[
            { 
              data: durations, 
              label: 'Minutos Médios', 
              color: '#0288d1',
              valueFormatter: (value) => `${value} min` 
            }
          ]}
          xAxis={[{
            data: agents,
            scaleType: 'band',
            tickLabelStyle: {
              angle: -45,
              textAnchor: 'end',
              fontSize: 12,
            }
          }]}
          yAxis={[{ label: 'Minutos' }]}
          height={350}
          margin={{ bottom: 70, left: 50 }}
        />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
        * Tempo calculado com base na duração total da chamada extraída da transcrição.
      </Typography>
    </Paper>
  );
};

export default AdminDurationChart;