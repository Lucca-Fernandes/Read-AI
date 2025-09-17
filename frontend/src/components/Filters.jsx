import React from 'react';
import { Grid, TextField, Select, MenuItem, InputLabel, FormControl, InputAdornment, Box, Button, Divider } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Filters = ({ 
  filter, setFilter, 
  keyword, setKeyword,
  startDate, setStartDate,
  endDate, setEndDate,
  onDateFilter 
}) => {

  const handleSetLastDays = (days) => {
    const end = new Date();
    const start = subDays(end, days);
    onDateFilter(start, end);
  };

  const handleClear = () => {
    onDateFilter(null, null);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
      <Grid container spacing={{ xs: 1, sm: 2 }} alignItems="center">
        {/* --- LINHA 1: Filtro, Ordenação e Busca por Palavra-chave --- */}
        <Grid item xs={12} sm={4}>
          <FormControl fullWidth variant="outlined">
            <InputLabel>Filtro e Ordenação</InputLabel>
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              label="Filtro e Ordenação"
              startAdornment={<InputAdornment position="start"><FilterListIcon /></InputAdornment>}
            >
              <MenuItem value="all">Mais Recentes</MenuItem>
              <MenuItem value="score_desc">Melhores (Maior Score)</MenuItem>
              <MenuItem value="score_asc">Piores (Menor Score)</MenuItem>
              <MenuItem value="not_conducted">Não Realizadas</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={8}>
          <TextField
            label="Buscar por Monitor ou Título"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            fullWidth
            variant="outlined"
            InputProps={{
              startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>),
            }}
          />
        </Grid>

        {/* --- LINHA 2: Filtro de Datas --- */}
        <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
        </Grid>

        <Grid item xs={12} sm={3} md={2}>
            <DatePicker
                label="Data de Início"
                value={startDate}
                onChange={(newValue) => setStartDate(newValue)}
                renderInput={(params) => <TextField {...params} fullWidth />}
            />
        </Grid>
        <Grid item xs={12} sm={3} md={2}>
            <DatePicker
                label="Data de Fim"
                value={endDate}
                onChange={(newValue) => setEndDate(newValue)}
                renderInput={(params) => <TextField {...params} fullWidth />}
            />
        </Grid>
        <Grid item xs={12} sm={6} md={8} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            {/* O botão "Filtrar Período" foi removido */}
            <Button variant="outlined" onClick={() => handleSetLastDays(7)}>Últimos 7 dias</Button>
            <Button variant="outlined" onClick={() => handleSetLastDays(30)}>Últimos 30 dias</Button>
            <Button variant="text" onClick={handleClear}>Limpar Datas</Button>
        </Grid>

      </Grid>
    </LocalizationProvider>
  );
};

export default Filters;