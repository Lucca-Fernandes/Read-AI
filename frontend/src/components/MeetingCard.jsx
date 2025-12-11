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
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LinkIcon from '@mui/icons-material/Link';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

import EvaluationDetails from './EvaluationDetails';

// Parse simples apenas para extrair resumo visual no card (não afeta a nota)
const parseSummaryOnly = (text) => {
  if (!text || typeof text !== 'string') return '';
  const summaryRegex = /\*\*Resumo da Análise:\*\*([\s\S]*?)(?=FINAL_SCORE:|CRITÉRIOS|1\.|$)/i;
  const summaryMatch = text.match(summaryRegex);
  return summaryMatch ? summaryMatch[1].trim() : text.substring(0, 150) + '...';
};

const MeetingCard = ({ meeting }) => {
    const [expanded, setExpanded] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    // Lógica de exibição da nota no Card (Prioridade: Banco de Dados > Texto > 0)
    let displayScore = 0;
    if (meeting.score !== undefined && meeting.score !== null) {
        displayScore = parseInt(meeting.score, 10);
    } else {
        const text = meeting.evaluationText || meeting.evaluation_text || '';
        const match = text.match(/FINAL_SCORE:?\s*(\d+)/i);
        if (match) displayScore = parseInt(match[1], 10);
    }

    const summaryText = parseSummaryOnly(meeting.evaluationText || meeting.evaluation_text);

    const getStatusColor = (score) => {
        if (score === -1) return 'default';
        if (score === 0) return 'error';
        if (score >= 80) return 'success';
        if (score > 0 && score <= 50) return 'warning';
        return 'primary';
    };

    const getScoreLabel = (score) => {
        if (score === null) return 'Avaliando...';
        if (score === 0) return 'Nota: 0'; 
        return `Nota: ${score}`;
    };

    const handleScoreClick = () => {
        setModalOpen(true);
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
                    borderLeftColor: `${getStatusColor(displayScore)}.main`,
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
                                label={getScoreLabel(displayScore)}
                                color={getStatusColor(displayScore)}
                                icon={displayScore === 0 ? <ErrorOutlineIcon /> : null}
                                sx={{ fontWeight: 'bold', cursor: 'pointer' }}
                                onClick={handleScoreClick}
                            />
                            <IconButton onClick={() => setExpanded(!expanded)} sx={{ color: 'secondary.main' }}>
                                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                        </Box>
                    </Box>

                    {/* Informações Básicas */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <PersonIcon sx={{ color: 'text.secondary', fontSize: '1.2rem' }} />
                            <Typography variant="body2"><strong>Monitor:</strong> {meeting.owner_name}</Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AccessTimeIcon sx={{ color: 'text.secondary', fontSize: '1.2rem' }} />
                            <Typography variant="body2">
                                <strong>Duração:</strong> {meeting.duration_minutes ? `${meeting.duration_minutes} min` : '0 min'}
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                        <DescriptionIcon sx={{ color: 'text.secondary', fontSize: '1.2rem', mt: '4px' }} />
                        <Typography variant="body2">
                            <strong>Resumo:</strong> {meeting.summary || summaryText || 'Sem resumo disponível.'}
                        </Typography>
                    </Box>

                    <Collapse in={expanded} timeout="auto" unmountOnExit>
                        <Divider sx={{ my: 2, borderColor: 'primary.light' }} />

                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                            <TopicIcon sx={{ color: 'text.secondary', fontSize: '1.2rem', mt: '4px' }} />
                            <Typography variant="body2"><strong>Tópicos:</strong> {(meeting.topics || []).join(', ') || 'Nenhum'}</Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <SentimentSatisfiedIcon sx={{ color: 'text.secondary', fontSize: '1.2rem' }} />
                            <Typography variant="body2"><strong>Sentimento:</strong> {meeting.sentiments}</Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                            <DescriptionIcon sx={{ color: 'text.secondary', fontSize: '1.2rem', mt: '4px' }} />
                            <Typography variant="body2">
                                <strong>Capítulos:</strong>{' '}
                                {(meeting.chapters || []).length > 0
                                    ? (meeting.chapters || []).map(c => `${c.title}: ${c.description}`).join(' | ')
                                    : 'Nenhum'}
                            </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                            <MicIcon sx={{ color: 'text.secondary', fontSize: '1.2rem', mt: '4px' }} />
                            <Typography variant="body2">
                                <strong>Transcrição:</strong>{' '}
                                {meeting.transcript ? meeting.transcript.substring(0, 150) + '...' : 'Nenhuma'}
                            </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                            <GroupIcon sx={{ color: 'text.secondary', fontSize: '1.2rem', mt: '4px' }} />
                            <Typography variant="body2">
                                <strong>Participantes:</strong>{' '}
                                {(meeting.participants || []).length > 0
                                    ? meeting.participants.map(p => typeof p === 'string' ? p : `${p.name} (${p.email})`).join(', ')
                                    : 'Nenhum'}
                            </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <CalendarTodayIcon sx={{ color: 'text.secondary', fontSize: '1.2rem' }} />
                                <Typography variant="caption"><strong>Início:</strong> {new Date(meeting.start_time).toLocaleString()}</Typography>
                            </Box>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                            <LinkIcon sx={{ color: 'text.secondary', fontSize: '1.2rem' }} />
                            <Typography variant="body2">
                                <strong>Link:</strong>{' '}
                                <a
                                    href={meeting.report_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: '#0284c7', textDecoration: 'none' }}
                                >
                                    Abrir no Read.ai
                                </a>
                            </Typography>
                        </Box>
                    </Collapse>
                </CardContent>

                {/* MODAL CORRIGIDO: Agora passa o SCORE do banco para o filho */}
                <Dialog open={modalOpen} onClose={handleCloseModal} maxWidth="md" fullWidth>
                    <DialogTitle sx={{ m: 0, p: 2, fontWeight: 'bold' }}>
                        Detalhes da Avaliação - {meeting.meeting_title}
                        <IconButton
                            onClick={handleCloseModal}
                            sx={{ position: 'absolute', right: 8, top: 8, color: (theme) => theme.palette.grey[500] }}
                        >
                            <CloseIcon />
                        </IconButton>
                    </DialogTitle>
                    <DialogContent dividers sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: 'grey.50' }}>
                        <EvaluationDetails 
                            evaluationText={meeting.evaluationText || meeting.evaluation_text} 
                            dbScore={meeting.score} 
                        />
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