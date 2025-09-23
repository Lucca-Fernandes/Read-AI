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

const MeetingCard = ({ meeting }) => {
    const [expanded, setExpanded] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    const getStatusColor = (score) => {
        if (score === -1) return 'default';      // Cinza para Falha de API
        if (score === -2) return 'default';      // Cinza para Falha na Análise
        if (score === 0) return 'error';         // Vermelho para Não Realizada
        if (score >= 80) return 'success';       // Verde para nota alta
        if (score > 0 && score <= 50) return 'warning'; // Amarelo para nota baixa
        return 'primary';                        // Azul para notas medianas
    };

    const getScoreLabel = (score) => {
        if (score === null) return 'Avaliando...';
        if (score === -1) return 'Falha na API';
        if (score === -2) return 'Falha na Análise'; // NOVO STATUS
        if (score === 0) return 'Não Realizada';
        return `Nota: ${score}`;
    };

    const handleScoreClick = () => {
        // Permite abrir o modal mesmo com falha, para ver o erro.
        if (meeting && meeting.score !== null && meeting.score !== 0) {
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
                    borderLeftColor: `${getStatusColor(meeting.score)}.main`,
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
                                label={getScoreLabel(meeting.score)}
                                color={getStatusColor(meeting.score)}
                                icon={meeting.score < 0 ? <ErrorOutlineIcon /> : null}
                                sx={{ fontWeight: 'bold', cursor: meeting.score !== null && meeting.score !== 0 ? 'pointer' : 'default' }}
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
                        {/* 👇 AQUI ESTÁ A CORREÇÃO FINAL E MAIS IMPORTANTE 👇 */}
                        <EvaluationDetails evaluationData={meeting.evaluation_details} />
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