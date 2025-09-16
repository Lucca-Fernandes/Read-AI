import React, { useState, useEffect, useMemo } from 'react'; // Adicionado useMemo para a função de parsing
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

    // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // INÍCIO DA LÓGICA DE PARSING CORRETA (COPIADA DE EvaluationDetails.js)
    // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    const parseEvaluationText = (text) => {
        if (!text || typeof text !== 'string') {
            return { sections: [], summary: 'Texto de avaliação inválido ou ausente.', finalScore: 0 };
        }

        try {
            const lines = text.split('\n').filter(line => line.trim() !== '');
            const sections = [];
            let currentSection = null;
            let summary = '';

            const summaryRegex = /\*\*Resumo da Análise:\*\*([\s\S]*?)(?=FINAL_SCORE:|$)/;
            const summaryMatch = text.match(summaryRegex);
            if (summaryMatch) {
                summary = summaryMatch[1].trim();
            }

            lines.forEach(line => {
                const sectionHeaderRegex = /\*\*(.*?)\(Peso Total: (-?\d+) pontos\)\*\*/;
                const headerMatch = line.match(sectionHeaderRegex);
                if (headerMatch) {
                    if (currentSection) sections.push(currentSection);
                    currentSection = {
                        title: headerMatch[1].trim(),
                        maxPoints: parseInt(headerMatch[2], 10),
                        criteria: []
                    };
                    return;
                }

                const criteriaRegex = /- (.*?)\s*\((\d+|Máximo: -?\d+) pontos\):\s*(-?\d+)\s*(?:\((.*?)\))?/;
                const criteriaMatch = line.match(criteriaRegex);
                if (criteriaMatch && currentSection) {
                    currentSection.criteria.push({
                        text: criteriaMatch[1].trim(),
                        maxPoints: parseInt(String(criteriaMatch[2]).replace('Máximo: ', ''), 10),
                        awardedPoints: parseInt(criteriaMatch[3], 10),
                        justification: (criteriaMatch[4] || '').trim(),
                    });
                    return;
                }

                const reducerRegex = /- (Uso de linguagem informal.*?)\s*\(-(\d+) pontos se sim, 0 se não\):\s*(-?\d+)/;
                const reducerMatch = line.match(reducerRegex);
                if (reducerMatch) {
                    const reducerSection = {
                        title: "Redutor de Linguagem",
                        maxPoints: -parseInt(reducerMatch[2], 10),
                        isReducer: true,
                        criteria: [{
                            text: reducerMatch[1].trim(),
                            maxPoints: -parseInt(reducerMatch[2], 10),
                            awardedPoints: parseInt(reducerMatch[3], 10),
                            justification: ""
                        }]
                    };
                    sections.push(reducerSection);
                }
            });

            if (currentSection) sections.push(currentSection);

            const finalScore = sections.reduce((total, section) => {
                return total + section.criteria.reduce((sectionSum, crit) => sectionSum + crit.awardedPoints, 0);
            }, 0);

            return { sections, summary, finalScore };
        } catch (error) {
            console.error("Falha ao parsear o texto de avaliação:", error);
            const fallbackScores = {
                week: text.match(/Perguntou sobre a semana do aluno\?\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
                prevGoal: text.match(/Verificou a conclusão da meta anterior\?\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
                newGoal: text.match(/Estipulou uma nova meta para o aluno\?\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
                content: text.match(/Perguntou sobre o conteúdo estudado\?\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
                exercises: text.match(/Perguntou sobre os exercícios\?\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
                doubts: text.match(/Esclareceu todas as dúvidas corretamente\?\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
                organization: text.match(/Demonstrou boa condução e organização\?\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
                motivation: text.match(/Incentivou o aluno a se manter no curso\?\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
                goalsImportance: text.match(/Reforçou a importância das metas e encontros\?\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
                extraSupport: text.match(/Ofereceu apoio extra\s*\(dicas, recursos\)\?\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
                risk: text.match(/Conduziu corretamente casos de desmotivação ou risco\?\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
                achievements: text.match(/Reconheceu conquistas e avanços do aluno\?\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
                goalFeedback: text.match(/Feedback sobre a meta\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
                languageReducer: text.match(/Uso de linguagem informal ou inadequada\?\s*[:\-]?\s*(-?\d+)/i)?.[1] || 0,
            };
            const fallbackFinalScore = Object.values(fallbackScores).reduce((sum, score) => sum + parseInt(score || 0, 10), 0);
            return { sections: [], summary: 'Falha ao processar a avaliação. Usando soma calculada como fallback.', finalScore: fallbackFinalScore, rawText: text };
        }
    };
    // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // FIM DA LÓGICA DE PARSING
    // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++


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
                    if (i % 2 === 0 && arr[i + 1]) {
                        acc.push({ name: curr.trim(), email: arr[i + 1].trim() });
                    }
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
        if (!meeting.transcript || meeting.transcript.trim().length < 50) {
            return { score: 0, evaluationText: 'Não realizada (transcrição insuficiente).' };
        }

        try {
            const prompt = `Analise a transcrição da reunião de monitoria. Sua análise e pontuação devem se basear estritamente nos diálogos e eventos descritos na transcrição.

**TAREFA:**

1. Para CADA UM dos subcritérios listados abaixo, atribua uma pontuação.
2. A pontuação de cada subcritério deve ser o valor máximo indicado se o critério foi totalmente cumprido, ou 0 se não foi cumprido ou se a informação não está na transcrição.
3. Liste a pontuação de cada subcritério de forma explícita.
4. Some todas as pontuações para calcular o Score Final.
5. Apresente um resumo da sua análise.
6. No final de TUDO, adicione a linha no formato exato: 'FINAL_SCORE: <seu score final aqui>'.

**CRITÉRIOS DE AVALIAÇÃO:**

**1. Progresso do Aluno (Peso Total: 50 pontos)**
   - Perguntou sobre a semana do aluno? (5 pontos):
   - Verificou a conclusão da meta anterior? (10 pontos):
   - Estipulou uma nova meta para o aluno? (10 pontos):
   - Perguntou sobre o conteúdo estudado? (20 pontos):
   - Perguntou sobre os exercícios? (5 pontos):

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
   - Feedback sobre a meta (5 pontos): A regra para este critério é: Se a meta anterior do aluno foi atingida, a nota é 5. Se a meta anterior NÃO foi atingida, a nota só será 5 se o monitor ofereceu um feedback construtivo sobre isso. Caso contrário, a nota é 0.

--- DADOS DA REUNIÃO ---

Resumo (Contexto Secundário): ${meeting.summary}
TRANSCRIÇÃO COMPLETA (Fonte Principal): ${meeting.transcript}`;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text().trim();

            // LÓGICA DE PARSING ANTIGA REMOVIDA
            // A NOVA LÓGICA USA A FUNÇÃO parseEvaluationText
            const { finalScore } = parseEvaluationText(responseText);
            
            return { score: finalScore, evaluationText: responseText };

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
                    <Box
                        onClick={handleTitleClick}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: { xs: 1, sm: 2 },
                            mb: 5,
                            cursor: 'pointer',
                            '&:hover': { transform: 'scale(1.025)' }
                        }}
                    >
                        <InsightsIcon
                            className="title-icon"
                            sx={{ fontSize: { xs: '2.5rem', sm: '3.5rem' }, color: 'primary.main' }}
                        />
                        <Typography
                            className="title-text"
                            variant="h3"
                            component="h1"
                            sx={{
                                fontWeight: 800,
                                background: (theme) => `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent'
                            }}
                        >
                            Painel de Análises
                        </Typography>
                    </Box>
                </Tooltip>
            </Fade>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 4 }}>
                <Box sx={{ flexGrow: 1 }}>
                    <Filters
                        filter={filter}
                        setFilter={setFilter}
                        keyword={keyword}
                        setKeyword={setKeyword}
                    />
                </Box>
                <Tooltip title="Recarregar e reavaliar todas as reuniões">
                    <Button
                        variant="contained"
                        color="secondary"
                        onClick={handleRefresh}
                        startIcon={<RefreshIcon />}
                        sx={{ height: '56px' }}
                    >
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
                <Grid container spacing={3}>
                    {meetings.map((meeting) => (
                        <Grid key={meeting.id} item xs={12} sm={6} md={4}>
                            <MeetingCard meeting={meeting} />
                        </Grid>
                    ))}
                </Grid>
            )}
        </Box>
    );
};

export default Dashboard;