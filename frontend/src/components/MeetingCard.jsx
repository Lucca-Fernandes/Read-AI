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

// FUNÇÃO ATUALIZADA
const parseEvaluationText = (text) => {
    if (!text || typeof text !== 'string') {
        return { sections: [], summary: 'Texto de avaliação inválido ou ausente.', finalScore: 0 };
    }

    // Normaliza o texto removendo múltiplos asteriscos e espaços extras em cada linha
    const lines = text.split('\n').map(line => line.trim().replace(/\*+/g, '')).filter(Boolean);

    const sections = [];
    let currentSection = null;
    let summary = '';
    let finalScore = 0;

    // Expressões Regulares mais flexíveis para capturar os dados
    const sectionHeaderRegex = /^##\s*(.*?)\s*(?:\(\s*\d+\s*\/\s*\d+\s*\))?$/;
    const criterionRegex = /^- (.*?)\s*(?:\||–|-)\s*(-?\d+)\s*\/\s*(\d+)\s*(?:(?:\||–|-)\s*(?:Justificativa:)?\s*(.*))?/;
    const summaryRegex = /^Resumo da Análise:\s*(.*)/i;
    const finalScoreRegex = /^Nota Final:\s*(\d+)\s*\/\s*100/i;

    for (const line of lines) {
        let match;

        if ((match = line.match(finalScoreRegex))) {
            finalScore = parseInt(match[1], 10);
        } else if ((match = line.match(summaryRegex))) {
            summary = match[1].trim();
        } else if ((match = line.match(sectionHeaderRegex))) {
            if (currentSection) sections.push(currentSection);
            currentSection = { title: match[1].trim(), criteria: [] };
        } else if (currentSection && (match = line.match(criterionRegex))) {
            currentSection.criteria.push({
                text: match[1].trim(),
                awardedPoints: match[2].trim(),
                maxPoints: match[3].trim(),
                justification: match[4] ? match[4].trim() : '',
            });
        }
    }

    if (currentSection) sections.push(currentSection);

    // Se, após tudo, nada for encontrado, pode ser uma mensagem de "não realizada"
    if (sections.length === 0 && !summary && finalScore === 0) {
        if (text.toLowerCase().includes("não foi realizada")) {
            return { sections: [], summary: text, finalScore: 0 };
        }
        // Fallback genérico se o formato for totalmente desconhecido
        return { sections: [], summary: 'O texto da avaliação não pôde ser analisado (formato irreconhecível).', finalScore: 0 };
    }

    return { sections, summary, finalScore };
};

const getScoreColor = (score) => {
    if (score === 0) return 'default';
    if (score >= 80) return 'success';
    if (score > 50) return 'primary';
    return 'error';
};

const MeetingCard = ({ meeting }) => {
    const [expanded, setExpanded] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    const { finalScore, summary } = parseEvaluationText(meeting.evaluation_text);
    const scoreColor = getScoreColor(finalScore);

    const handleExpandClick = () => setExpanded(!expanded);
    const handleOpenModal = () => setModalOpen(true);
    const handleCloseModal = () => setModalOpen(false);

    const isNotRealized = summary.toLowerCase().includes("não foi realizada") || finalScore === 0;

    return (
        <Tooltip title={isNotRealized ? "Clique para mais detalhes" : "Clique para ver a avaliação detalhada"} placement="top" arrow>
            <Card
                elevation={3}
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    borderRadius: 2,
                    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                    '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 6,
                    },
                    cursor: 'pointer',
                }}
            >
                <CardContent sx={{ flexGrow: 1 }} onClick={handleOpenModal}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Typography variant="h6" component="div" sx={{ fontWeight: 'bold', mb: 1, flexGrow: 1, pr: 1 }}>
                            {meeting.meeting_title}
                        </Typography>
                        <Chip
                            label={isNotRealized ? "Não Realizada" : `Nota: ${finalScore}`}
                            color={isNotRealized ? 'default' : scoreColor}
                            variant="filled"
                            icon={isNotRealized ? <ErrorOutlineIcon /> : null}
                            sx={{ fontWeight: 'bold' }}
                        />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary', mb: 1.5 }}>
                        <PersonIcon sx={{ mr: 1, fontSize: '1.2rem' }} />
                        <Typography variant="body2">{meeting.owner_name}</Typography>
                    </Box>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            minHeight: '40px',
                        }}
                    >
                        {summary}
                    </Typography>
                </CardContent>

                <Divider />

                <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
                            <CalendarTodayIcon sx={{ mr: 1, fontSize: '1.2rem' }} />
                            <Typography variant="caption">
                                {new Date(meeting.start_time).toLocaleDateString('pt-BR')}
                            </Typography>
                        </Box>
                        <IconButton
                            onClick={handleExpandClick}
                            aria-expanded={expanded}
                            aria-label="show more"
                        >
                            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                    </Box>

                    <Collapse in={expanded} timeout="auto" unmountOnExit>
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                <GroupIcon sx={{ mr: 1, color: 'text.secondary' }} />
                                <strong>Participantes:</strong>&nbsp;{meeting.participants?.length || 0}
                            </Typography>
                            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                <DescriptionIcon sx={{ mr: 1, color: 'text.secondary' }} />
                                <a href={meeting.report_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
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