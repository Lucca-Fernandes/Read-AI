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
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CloseIcon from '@mui/icons-material/Close';
import GroupIcon from '@mui/icons-material/Group';
import MicIcon from '@mui/icons-material/Mic';

import EvaluationDetails from './EvaluationDetails';

const MeetingCard = ({ meeting }) => {
    const [expanded, setExpanded] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    const getStatusColor = (score) => {
        if (score === -1) return 'default';
        if (score >= 80) return 'success';
        if (score > 50) return 'primary';
        return 'error';
    };

    const handleOpenModal = () => setModalOpen(true);
    const handleCloseModal = () => setModalOpen(false);
    const handleExpandClick = () => setExpanded(!expanded);

    const formattedDate = meeting.start_time ? new Date(meeting.start_time).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Data indisponível';

    return (
        <Tooltip title={meeting.meeting_title || 'Reunião sem título'} placement="top-start" arrow>
            <Card sx={{
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%',
                borderLeft: 5, borderColor: getStatusColor(meeting.score) + '.main'
            }}>
                <CardContent sx={{ pb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                        <Typography variant="h6" component="h3" sx={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical' }}>
                            {meeting.meeting_title || 'Reunião sem título'}
                        </Typography>
                        <Chip
                            label={`Nota: ${meeting.score === -1 ? 'Falhou' : meeting.score}`}
                            color={getStatusColor(meeting.score)}
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
                        {/* Correção aqui: evaluation_text */}
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