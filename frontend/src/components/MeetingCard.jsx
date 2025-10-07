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
import DescriptionIcon from '@mui/icons-material/Description';
import GroupIcon from '@mui/icons-material/Group';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

import EvaluationDetails from './EvaluationDetails';

// =======================================================================
// VERSÃO DEFINITIVA DA FUNÇÃO parseEvaluationText
// =======================================================================
const parseEvaluationText = (text) => {
    if (!text || typeof text !== 'string') {
        return { sections: [], summary: 'Texto de avaliação inválido ou ausente.', finalScore: 0 };
    }

    let finalScore = 0;
    let summary = '';
    let sections = [];
    let detailsText = text;

    // 1. Extrai a Nota Final (procura por múltiplos padrões em ordem de confiabilidade)
    const scoreMatchers = [
        /^FINAL_SCORE:\s*(\d+)/m,
        /Score Final:\s*.*?=\s*\**(\d+)\**/m,
        /Score Final Total:\s*.*?=\s*\**(\d+)\**/m,
        /^\*\*Score Final:\*\*\s*(\d+)\s*\/\s*100/m,
        /^\*\*Score Final:\*\*\s*(\d+)/m
    ];
    for (const matcher of scoreMatchers) {
        const scoreMatch = text.match(matcher);
        if (scoreMatch) {
            finalScore = parseInt(scoreMatch[1], 10);
            break;
        }
    }

    // 2. Extrai o Resumo (procura por múltiplos padrões de cabeçalho)
    const summaryHeaderMatchers = [
        /\n---\s*\*\*Resumo da Análise:\*\*/m,
        /\n\*\*Resumo da Análise:\*\*/m,
        /^\*\*Resumo da Análise:\*\*/m,
        /^Resumo da Análise:/m
    ];
    for (const matcher of summaryHeaderMatchers) {
        const summarySplit = text.split(matcher);
        if (summarySplit.length > 1) {
            summary = summarySplit[1].split(/---|\*\*Score Final|FINAL_SCORE/m)[0].trim();
            detailsText = summarySplit[0]; // O que veio antes do resumo são os detalhes
            break;
        }
    }

    // 3. Processa os detalhes
    if (detailsText && detailsText.trim()) {
        const lines = detailsText.split('\n').map(line => line.trim());
        let currentSection = null;
        let lastCriterion = null;

        const sectionRegex = /^\*\*\s*\d+\.\s*(.*?)\s*\(Peso Total: \d+ pontos\)\*\*/;
        const criterionRegex = /^\s*-\s*(.*?)\s*\((\d+)\s*pontos\):\s*(-?\d+)/;
        const evidenceRegex = /^(?:- Evidência:|\*Justificativa:|- Justificativa:)\s*(.*)/i;

        for (const line of lines) {
            const sectionMatch = line.match(sectionRegex);
            if (sectionMatch) {
                const newSection = { title: sectionMatch[1].trim(), criteria: [] };
                sections.push(newSection);
                currentSection = newSection;
                lastCriterion = null;
                continue;
            }

            const criterionMatch = line.match(criterionRegex);
            if (criterionMatch) {
                if (!currentSection) {
                    currentSection = { title: "Critérios de Avaliação", criteria: [] };
                    sections.push(currentSection);
                }
                const newCriterion = {
                    text: criterionMatch[1].trim(),
                    awardedPoints: criterionMatch[3].trim(),
                    maxPoints: criterionMatch[2].trim(),
                    justification: '',
                };
                currentSection.criteria.push(newCriterion);
                lastCriterion = newCriterion;
                continue;
            }

            const evidenceMatch = line.match(evidenceRegex);
            if (evidenceMatch && lastCriterion) {
                lastCriterion.justification = evidenceMatch[1].trim();
            }
        }
        sections = sections.filter(s => s.criteria.length > 0);
    }
    
    // 4. Lógica final de retorno
    if (sections.length === 0 && !summary) {
        return { 
            sections: [], 
            summary: `(Formato não reconhecido):\n\n${text}`, 
            finalScore: finalScore 
        };
    }

    return { sections, summary: summary || "Nenhum resumo encontrado.", finalScore };
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

    const isNotProcessed = finalScore === 0 && (summary.toLowerCase().includes('não foi reconhecido') || summary.toLowerCase().includes("não foi realizada"));

    return (
        <Tooltip title={isNotProcessed ? "Clique para mais detalhes" : "Clique para ver a avaliação detalhada"} placement="top" arrow>
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
                            label={isNotProcessed ? "Não Processada" : `Nota: ${finalScore}`}
                            color={isNotProcessed ? 'default' : scoreColor}
                            variant="filled"
                            icon={isNotProcessed ? <ErrorOutlineIcon /> : null}
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