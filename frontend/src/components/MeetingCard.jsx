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
// NOVA FUNÇÃO parseEvaluationText (CORRIGIDA)
// =======================================================================
const parseEvaluationText = (text) => {
    if (!text || typeof text !== 'string') {
        return { sections: [], summary: 'Texto de avaliação inválido ou ausente.', finalScore: 0 };
    }

    // Procura pela nota final primeiro, é o dado mais confiável
    const finalScoreMatch = text.match(/^FINAL_SCORE:\s*(\d+)/m) || text.match(/Score Final Total:.*?=\s*(\d+)/);
    const finalScore = finalScoreMatch ? parseInt(finalScoreMatch[1], 10) : 0;

    // Procura pelo resumo
    const summaryMatch = text.split(/---\s*\*\*Resumo da Análise:\*\*|^\*\*Resumo da Análise:\*\*/m);
    let summary = summaryMatch.length > 1 ? summaryMatch[1].split('---')[0].trim() : 'Resumo não encontrado.';
    
    // Remove a linha FINAL_SCORE do resumo, se existir
    summary = summary.replace(/^FINAL_SCORE:\s*\d+/m, '').trim();

    // Se o texto indica que a reunião não foi realizada, retorna imediatamente
    if (text.toLowerCase().includes("não foi realizada")) {
      return { sections: [], summary: text, finalScore: 0 };
    }
    
    const sections = [];
    let currentSection = null;
    let lastCriterion = null;

    const lines = text.split('\n').map(line => line.trim());

    for (const line of lines) {
        // Tenta identificar um cabeçalho de seção (ex: **1. Progresso do Aluno (Peso Total: 50 pontos)**)
        const sectionMatch = line.match(/^\*\*\s*\d+\.\s*(.*?)\s*\(Peso Total: (\d+) pontos\)\*\*/);
        if (sectionMatch) {
            if (currentSection) sections.push(currentSection);
            currentSection = { title: sectionMatch[1].trim(), criteria: [] };
            continue;
        }
        
        // Tenta identificar um critério de avaliação (ex: - Perguntou sobre a semana do aluno? (5 pontos): 5)
        const criterionMatch = line.match(/^- (.*?)\s*\((\d+) pontos\):\s*(-?\d+)/);
        if (criterionMatch && currentSection) {
            const newCriterion = {
                text: criterionMatch[1].trim(),
                awardedPoints: criterionMatch[3].trim(),
                maxPoints: criterionMatch[2].trim(),
                justification: '',
            };
            currentSection.criteria.push(newCriterion);
            lastCriterion = newCriterion; // Guarda a referência para o último critério
            continue;
        }

        // Tenta identificar uma justificativa/evidência e associá-la ao critério anterior
        const evidenceMatch = line.match(/^(?:- Evidência:|\*Justificativa\*:)\s*(.*)/);
        if (evidenceMatch && lastCriterion) {
            lastCriterion.justification = evidenceMatch[1].trim();
        }
    }

    if (currentSection) sections.push(currentSection);

    // Se, após tudo, nada for encontrado, retorna o estado de falha
    if (sections.length === 0) {
        return { 
            sections: [], 
            summary: `(O formato da avaliação não foi reconhecido. Exibindo texto original da IA):\n\n${text}`, 
            finalScore: finalScore 
        };
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

    // No `MeetingCard`, passamos o evaluation_text
    const { finalScore, summary } = parseEvaluationText(meeting.evaluation_text);
    const scoreColor = getScoreColor(finalScore);

    const handleExpandClick = () => setExpanded(!expanded);
    const handleOpenModal = () => setModalOpen(true);
    const handleCloseModal = () => setModalOpen(false);

    const isNotRealized = summary.toLowerCase().includes("não foi realizada") || finalScore === 0 && summary.toLowerCase().includes('não foi reconhecido');

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
                            label={isNotRealized ? "Não Processada" : `Nota: ${finalScore}`}
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
                        {/* Aqui passamos o evaluation_text para o componente filho */}
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