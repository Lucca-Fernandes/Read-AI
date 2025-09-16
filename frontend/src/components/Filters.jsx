import React from 'react';
import { Grid, TextField, Select, MenuItem, InputLabel, FormControl, InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';

const Filters = ({ filter, setFilter, keyword, setKeyword }) => { // <<< ALTERAÇÃO: prop 'onSearch' removida
  return (
    <Grid container spacing={{ xs: 1, sm: 2 }} alignItems="center">
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
      {/* <<< ALTERAÇÃO: Grid item ajustado para ocupar mais espaço >>> */}
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
      {/* <<< ALTERAÇÃO: O Grid item com o botão "Buscar" foi completamente removido >>> */}
    </Grid>
  );
};

export default Filters;