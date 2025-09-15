import React, { useState, useEffect } from 'react';

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

import { GoogleGenerativeAI } from '@google/generative-ai';



import MeetingCard from './MeetingCard';

import Filters from './Filters';

import DashboardChart from './DashboardChart';



const Dashboard = () => {

  // ... (estados não foram alterados)

  const [originalMeetings, setOriginalMeetings] = useState([]);

  const [meetings, setMeetings] = useState([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState(null);

  const [filter, setFilter] = useState('all');

  const [keyword, setKeyword] = useState('');

  const [chartData, setChartData] = useState([]);



  const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

  const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;

  const RANGE = 'Página1!A1:L50';

  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });



  useEffect(() => {

    fetchMeetings();

  }, []);



  useEffect(() => {

    // ... (lógica de filtros não foi alterada)

    if (originalMeetings.length === 0) return;

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

    // ... (lógica do gráfico não foi alterada)

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



  const fetchMeetings = async (forceRefresh = false) => {

    if (!forceRefresh) {

      try {

        const cachedData = localStorage.getItem('evaluatedMeetings');

        if (cachedData) {

          setOriginalMeetings(JSON.parse(cachedData));

          return;

        }

      } catch (storageError) {

        setError("Não foi possível ler o cache. Tente atualizar.");

      }

    }

    setLoading(true);

    setError(null);

    try {

      const response = await axios.get(

        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`

      );

      const rows = response.data.values || [];

     

      // <<< CORREÇÃO PRINCIPAL AQUI >>>

      // Garantindo que todos os campos sejam mapeados corretamente, evitando 'undefined'

      const meetingsData = rows.slice(1).map((row, index) => ({

        id: index + 1,

        session_id: row[0] || 'unknown',

        meeting_title: row[1] || 'Sem título',

        start_time: row[2] || '',

        end_time: row[3] || '',

        owner_name: row[4] ? row[4].trim() : 'Desconhecido',

        summary: row[5] || 'Sem resumo',

        topics: row[6] ? row[6].split(',').filter(t => t && t.toLowerCase() !== 'nenhum' && t.trim() !== '') : [],

        sentiments: row[7] || 'Unknown',

        report_url: row[8] || '',

        chapters: row[9] ? row[9].split(';').filter(c => c).map(c => {

          const parts = c.split(',').map(s => s.trim());

          return { title: parts[0] || '', description: parts[1] || '' };

        }) : [],

        transcript: row[10] || '',

        participants: (row[11] || '').split(',').reduce((acc, curr, i, arr) => {

          if (i % 2 === 0 && arr[i + 1]) acc.push({ name: curr.trim(), email: arr[i + 1].trim() });

          return acc;

        }, []),

        score: null,

        evaluationText: ''

      }));

     

      const evaluatedMeetings = await Promise.all(

        meetingsData.map(async (meeting) => {

          const { score, evaluationText } = await evaluateMeetingWithGemini(meeting);

          return { ...meeting, score, evaluationText };

        })

      );

      localStorage.setItem('evaluatedMeetings', JSON.stringify(evaluatedMeetings));

      setOriginalMeetings(evaluatedMeetings);

    } catch (err) {

      setError(`Falha ao carregar reuniões: ${err.message}`);

    } finally {

      setLoading(false);

    }

  };



  const evaluateMeetingWithGemini = async (meeting) => {

    // ... (função evaluateMeetingWithGemini, sem alterações)

    if (!meeting.transcript || meeting.transcript.trim().length < 50) {

      return { score: 0, evaluationText: 'Não realizada (transcrição insuficiente).' };

    }

    try {

      const prompt = `Analise a transcrição da reunião de monitoria. Sua análise e pontuação devem se basear estritamente nos diálogos e eventos descritos na transcrição.



**TAREFA:**

1. Para CADA UM dos subcritérios listados abaixo, atribua uma pontuação.

2. A pontuação de cada subcritério deve ser o valor máximo indicado se o critério foi totalmente cumprido, ou 0 se não foi cumprido ou se a informação não está na transcrição. Para o critério da meta semanal, use a pontuação parcial (metade) conforme instruído.

3. Liste a pontuação de cada subcritério de forma explícita.

4. Some todas as pontuações para calcular o Score Parcial.

5. Se detectar linguagem informal (gírias, vícios de linguagem) por parte do monitor, aplique um redutor de -10 pontos. Se a linguagem for formal, o redutor é 0.

6. Calcule o Score Final (Score Parcial + Redutor de Linguagem).

7. Apresente um resumo da sua análise.

8. No final de TUDO, adicione a linha no formato exato: 'FINAL_SCORE: <seu score final aqui>'.



**CRITÉRIOS DE AVALIAÇÃO:**



**1. Progresso do Aluno (Peso Total: 55 pontos)**

   - Perguntou sobre a semana do aluno? (5 pontos):

   - Verificou a meta anterior e passou uma nova? (20 pontos - conceder 10 se o aluno não bateu a meta anterior mas uma nova foi passada):

   - Perguntou sobre o conteúdo estudado? (20 pontos):

   - Perguntou sobre os exercícios? (10 pontos):



**2. Qualidade do Atendimento (Peso Total: 15 pontos)**

   - Esclareceu todas as dúvidas corretamente? (10 pontos):

   - Demonstrou boa condução e organização? (5 pontos):



**3. Engajamento e Motivação (Peso Total: 15 pontos)**

   - Incentivou o aluno a se manter no curso? (5 pontos):

   - Reforçou a importância das metas e encontros? (5 pontos):

   - Ofereceu apoio extra (dicas, recursos)? (5 pontos):



**4. Registro de Sinais de Risco (Peso Total: 10 pontos)**

   - Conduziu corretamente casos de desmotivação ou risco? (10 pontos):



**5. Feedback ao Aluno (Peso Total: 10 pontos)**

   - Reconheceu conquistas e avanços do aluno? (5 pontos):

   - Deu feedback construtivo quando a meta não foi atingida? (5 pontos):



**Redutor de Linguagem (Máximo: -10 pontos)**

   - Uso de linguagem informal pelo monitor (gírias, vícios)? (-10 pontos se sim, 0 se não):



--- DADOS DA REUNIÃO ---

Resumo (Contexto Secundário): ${meeting.summary}

TRANSCRIÇÃO COMPLETA (Fonte Principal): ${meeting.transcript}`;



      const result = await model.generateContent(prompt);

      const responseText = result.response.text().trim();

      const scoreMatch = responseText.match(/FINAL_SCORE:\s*(\d{1,3})/);

      let score = -1;

      if (scoreMatch && scoreMatch[1]) {

        score = parseInt(scoreMatch[1], 10);

      } else {

        return { score: -1, evaluationText: `FALHA NO PARSING: IA não retornou score. Resposta: "${responseText}"` };

      }

      return { score, evaluationText: responseText };

    } catch (err) {

      return { score: -1, evaluationText: `FALHA: Erro de API. ${err.message}` };

    }

  };



  const handleTitleClick = () => {

    setFilter('all');

    setKeyword('');

  };



  const handleRefresh = () => {

    localStorage.removeItem('evaluatedMeetings');

    fetchMeetings(true);

  };



  return (

    <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: 1600, mx: 'auto' }}>

      <Fade in timeout={800}>

        <Tooltip title="Clique para resetar os filtros" arrow placement="bottom">

            <Box onClick={handleTitleClick} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 1, sm: 2 }, mb: 5, cursor: 'pointer', '&:hover': { transform: 'scale(1.025)' } }}>

              <InsightsIcon className="title-icon" sx={{ fontSize: { xs: '2.5rem', sm: '3.5rem' }, color: 'primary.main' }}/>

              <Typography className="title-text" variant="h3" component="h1" sx={{ fontWeight: 800, background: (theme) => `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>

                Painel de Análises

              </Typography>

            </Box>

        </Tooltip>

      </Fade>



      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 4 }}>

        <Box sx={{ flexGrow: 1 }}>

          <Filters filter={filter} setFilter={setFilter} keyword={keyword} setKeyword={setKeyword} />

        </Box>

        <Tooltip title="Recarregar e reavaliar todas as reuniões">

          <Button variant="contained" color="secondary" onClick={handleRefresh} startIcon={<RefreshIcon />} sx={{ height: '56px' }}>

            Atualizar

          </Button>

        </Tooltip>

      </Box>



      <Fade in={chartData.length > 0} timeout={800}>

        <Box mb={5}>

          <DashboardChart chartData={chartData} />

        </Box>

      </Fade>



      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {loading ? (

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 5 }}>

          <CircularProgress color="secondary" sx={{ mb: 2 }} />

          <Typography>Carregando e avaliando reuniões...</Typography>

        </Box>

      ) : meetings.length === 0 && !error ? (

        <Typography sx={{ textAlign: 'center', my: 5 }}>

          Nenhuma reunião encontrada com os filtros aplicados.

        </Typography>

      ) : (

        // <<< CORREÇÃO DO GRID V2 >>>

        <Grid container spacing={3}>

          {meetings.map((meeting) => (

            <Grid xs={12} md={6} lg={4} key={meeting.id}>

              <MeetingCard meeting={meeting} />

            </Grid>

          ))}

        </Grid>

      )}

    </Box>

  );

};



export default Dashboard;