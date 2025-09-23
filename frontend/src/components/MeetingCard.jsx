import React, { useState, useMemo } from 'react';
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

// --- LÓGICA DE CÁLCULO DA NOTA ---
// Esta função analisa o texto da avaliação e calcula a nota com base nos critérios.
const getCalculatedScore = (evaluationText) => {
    if (!evaluationText || typeof evaluationText !== 'string') return -1;

    const lines = evaluationText.split('\n');
    let totalAwarded = 0;
    let totalMax = 0;

    lines.forEach(line => {
        // Procura por linhas que contenham o padrão "texto: nota/max"
        const match = line.match(/-\s(.*?):\s*(-?\d+)\/(\d+)/);
        if (match) {
            const awarded = parseInt(match[2], 10);
            const max = parseInt(match[3], 10);
            if (!isNaN(awarded) && !isNaN(max) && max > 0) {
                totalAwarded += awarded;
                totalMax += max;
            }
        }
    });

    if (totalMax === 0) return -1; // Retorna -1 se nenhum critério pontuável for encontrado

    return Math.round((totalAwarded / totalMax) * 100);
};


const MeetingCard = ({ meeting }) => {
    const [expanded, setExpanded] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    const getStatusColor = (score) => {
        if (score === -1) return 'default';
        if (score >= 80) return 'success';
        if (score > 50) return 'primary';
        return 'error';
    };

    // Usamos useMemo para calcular a nota apenas uma vez, a menos que a avaliação mude.
    const calculatedScore = useMemo(() => getCalculatedScore(meeting.evaluation_text), [meeting.evaluation_text]);

    const handleOpenModal = () => setModalOpen(true);
    const handleCloseModal = () => setModalOpen(false);
    const handleExpandClick = () => setExpanded(!expanded);

    const formattedDate = meeting.start_time ? new Date(meeting.start_time).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Data indisponível';

    return (
        <Tooltip title={meeting.meeting_title || 'Reunião sem título'} placement="top-start" arrow>
            <Card sx={{
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%',
                borderLeft: 5, borderColor: getStatusColor(calculatedScore) + '.main'
            }}>
                <CardContent sx={{ pb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                        <Typography variant="h6" component="h3" sx={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical' }}>
                            {meeting.meeting_title || 'Reunião sem título'}
                        </Typography>
                        <Chip
                            label={`Nota: ${calculatedScore === -1 ? 'N/A' : calculatedScore}`}
                            color={getStatusColor(calculatedScore)}
                            size="small"
                            sx={{ fontWeight: 'bold' }}
                        />
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary', gap: 0.5, mb: 0.5 }}>
                        <PersonIcon fontSize="small" />
                        <Typography variant="body2">{meeting.owner_name || 'Monitor não identificado'}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary', gap: 0.5 }}>
                        <CalendarTodayIcon fontSize="small" />
                        <Typography variant="body2">{formattedDate}</Typography>
                    </Box>

                    <Divider sx={{ my: 1.5 }} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Button onClick={handleOpenModal} variant="outlined" size="small">
                            Ver Detalhes
                        </Button>
                        <Tooltip title={expanded ? "Mostrar menos" : "Mostrar mais"} arrow>
                            <IconButton onClick={handleExpandClick} size="small">
                                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                        </Tooltip>
                    </Box>

                    <Collapse in={expanded} timeout="auto" unmountOnExit>
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>Informações Adicionais:</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, color: 'text.secondary' }}>
                                <GroupIcon fontSize="small" />
                                <Typography variant="body2">Participantes: {meeting.participants?.length || 0}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, color: 'text.secondary' }}>
                                <MicIcon fontSize="small" />
                                <Typography variant="body2">Tópicos discutidos: {meeting.topics?.length || 0}</Typography>
                            </Box>
                            <Typography variant="caption" display="block" sx={{ color: 'text.disabled', mt: 1 }}>
                                Session ID: {meeting.session_id}
                            </Typography>
                            <Typography variant="caption" display="block">
                                <a href={meeting.report_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
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
                        <EvaluationDetails evaluationText={meeting.evaluation_text} />
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