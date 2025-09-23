import React, { useState } from 'react';
import {
    Card,
    CardContent,
    Typography,
    Box,
    Chip,
    Tooltip,
    IconButton,
    Collapse,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import TopicIcon from '@mui/icons-material/Topic';
import SentimentSatisfiedIcon from '@mui/icons-material/SentimentSatisfied';
import DescriptionIcon from '@mui/icons-material/Description';
import MicIcon from '@mui/icons-material/Mic';
import GroupIcon from '@mui/icons-material/Group';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LinkIcon from '@mui/icons-material/Link';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

import EvaluationDetails from './EvaluationDetails';

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

const MeetingCard = ({ meeting }) => {
    const [expanded, setExpanded] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    const { finalScore } = parseEvaluationText(meeting.evaluationText);

    const getStatusColor = (score) => {
        if (score === -1) return 'default'; // Cinza para falha
        if (score === 0) return 'error'; // Vermelho para não realizada
        if (score >= 80) return 'success'; // Verde para nota alta
        if (score > 0 && score <= 50) return 'warning'; // Amarelo para nota baixa
        return 'primary'; // Azul para notas medianas
    };

    const getScoreLabel = (score) => {
        if (score === null) return 'Avaliando...';
        if (score === -1) return 'Falha na Avaliação';
        if (score === 0) return 'Não Realizada';
        return `Nota: ${score}`;
    };

    const handleScoreClick = () => {
        if (meeting && finalScore !== null) {
            setModalOpen(true);
        }
    };

    const handleCloseModal = () => {
        setModalOpen(false);
    };

    return (
        <Tooltip title={`ID da Sessão: ${meeting.session_id}`}>
            <Card
                sx={{
                    mb: 2,
                    borderLeft: `6px solid`,
                    borderLeftColor: `${getStatusColor(finalScore)}.main`,
                    transition: 'box-shadow 0.3s ease-in-out, transform 0.2s ease-in-out',
                    '&:hover': {
                        boxShadow: 6,
                        transform: 'translateY(-4px)',
                    },
                }}
            >
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                            {meeting.meeting_title}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                                label={getScoreLabel(finalScore)}
                                color={getStatusColor(finalScore)}
                                icon={finalScore === -1 ? <ErrorOutlineIcon /> : null}
                                sx={{ fontWeight: 'bold', cursor: finalScore !== null ? 'pointer' : 'default' }}
                                onClick={handleScoreClick}
                            />
                            <IconButton onClick={() => setExpanded(!expanded)} sx={{ color: 'secondary.main' }}>
                                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <PersonIcon sx={{ color: 'text.secondary', fontSize: '1.2rem' }} />
                        <Typography><strong>Monitor:</strong> {meeting.owner_name}</Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                        <DescriptionIcon sx={{ color: 'text.secondary', fontSize: '1.2rem', mt: '4px' }} />
                        <Typography>
                            <strong>Resumo:</strong> {meeting.summary}
                        </Typography>
                    </Box>

                    <Collapse in={expanded} timeout="auto" unmountOnExit>
                        <Divider sx={{ my: 2, borderColor: 'primary.light' }} />

                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                            <TopicIcon sx={{ color: 'text.secondary', fontSize: '1.2rem', mt: '4px' }} />
                            <Typography><strong>Tópicos:</strong> {(meeting.topics || []).join(', ') || 'Nenhum'}</Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <SentimentSatisfiedIcon sx={{ color: 'text.secondary', fontSize: '1.2rem' }} />
                            <Typography><strong>Sentimento:</strong> {meeting.sentiments}</Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                            <DescriptionIcon sx={{ color: 'text.secondary', fontSize: '1.2rem', mt: '4px' }} />
                            <Typography>
                                <strong>Capítulos:</strong>{' '}
                                {(meeting.chapters || []).length > 0
                                    ? (meeting.chapters || []).map(c => `${c.title}: ${c.description}`).join(' | ')
                                    : 'Nenhum'}
                            </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                            <MicIcon sx={{ color: 'text.secondary', fontSize: '1.2rem', mt: '4px' }} />
                            <Typography>
                                <strong>Transcrição:</strong>{' '}
                                {meeting.transcript ? meeting.transcript.substring(0, 100) + '...' : 'Nenhuma'}
                            </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                            <GroupIcon sx={{ color: 'text.secondary', fontSize: '1.2rem', mt: '4px' }} />
                            <Typography>
                                <strong>Participantes:</strong>{' '}
                                {(meeting.participants || []).length > 0
                                    ? (meeting.participants || []).map(p => `${p.name} (${p.email})`).join(', ')
                                    : 'Nenhum'}
                            </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <CalendarTodayIcon sx={{ color: 'text.secondary', fontSize: '1.2rem' }} />
                            <Typography><strong>Data:</strong> {new Date(meeting.start_time).toLocaleString()}</Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinkIcon sx={{ color: 'text.secondary', fontSize: '1.2rem' }} />
                            <Typography>
                                <strong>Link:</strong>{' '}
                                <a
                                    href={meeting.report_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: '#0284c7', textDecoration: 'none' }}
                                    onMouseEnter={(e) => (e.target.style.textDecoration = 'underline')}
                                    onMouseLeave={(e) => (e.target.style.textDecoration = 'none')}
                                >
                                    Ver relatório
                                </a>
                            </Typography>
                        </Box>
                    </Collapse>
                </CardContent>

                <Dialog open={modalOpen} onClose={handleCloseModal} maxWidth="md" fullWidth>
                    <DialogTitle sx={{ m: 0, p: 2, fontWeight: 'bold' }}>
                        Detalhes da Avaliação - {meeting.meeting_title}
                        <IconButton
                            aria-label="close"
                            onClick={handleCloseModal}
                            sx={{ position: 'absolute', right: 8, top: 8, color: (theme) => theme.palette.grey[500] }}
                        >
                            <CloseIcon />
                        </IconButton>
                    </DialogTitle>
                    
                    <DialogContent dividers sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: 'grey.50' }}>
                        <EvaluationDetails evaluationText={meeting.evaluationText} />
                    </DialogContent>
                    
                    <DialogActions>
                        <Button onClick={handleCloseModal} color="primary" variant="contained">
                            Fechar
                        </Button>
                    </DialogActions>
                </Dialog>
            </Card>
        </Tooltip>
    );
};

export default MeetingCard;