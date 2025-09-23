import React, { useMemo } from 'react';
import {
    Box,
    Typography,
    Chip,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Paper,
    Divider,
    Grid,
    Tooltip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import InfoIcon from '@mui/icons-material/Info';

// Parser original, que entende o formato **Seção** e - Criterio: nota/max
const parseEvaluationText = (text) => {
    if (!text || typeof text !== 'string') {
        return { sections: [], summary: '' };
    }

    const lines = text.split('\n');
    const sections = [];
    let currentSection = null;
    let summary = '';
    let isSummarySection = false;

    for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
            isSummarySection = false;
            const title = trimmedLine.substring(2, trimmedLine.length - 2);
            if (title.toLowerCase().includes('resumo da análise')) {
                isSummarySection = true;
                continue;
            }
            currentSection = { title, criteria: [] };
            sections.push(currentSection);
            continue;
        }

        if (isSummarySection) {
            summary += line + '\n';
            continue;
        }
        
        const match = trimmedLine.match(/-\s(.*?):\s*(-?\d+)\/(\d+)/);
        if (match && currentSection) {
            const justificationMatch = trimmedLine.match(/\((.*?)\)/);
            currentSection.criteria.push({
                text: match[1].trim(),
                awardedPoints: parseInt(match[2], 10),
                maxPoints: parseInt(match[3], 10),
                justification: justificationMatch ? justificationMatch[1] : '',
            });
        }
    }

    return { sections, summary: summary.trim() };
};

const EvaluationDetails = ({ evaluationText }) => {
    const { sections, summary } = useMemo(() => parseEvaluationText(evaluationText), [evaluationText]);

    const { totalScore, maxScore } = useMemo(() => {
        let total = 0;
        let max = 0;
        sections.forEach(section => {
            section.criteria.forEach(item => {
                total += item.awardedPoints;
                max += item.maxPoints;
            });
        });
        return { totalScore: total, maxScore: max };
    }, [sections]);

    const getStatusIcon = (awarded, max) => {
        if (awarded === max) return <Tooltip title="Critério atingido"><CheckCircleIcon color="success" /></Tooltip>;
        if (awarded > 0) return <Tooltip title="Critério parcialmente atingido"><InfoIcon color="primary" /></Tooltip>;
        return <Tooltip title="Critério não atingido"><CancelIcon color="error" /></Tooltip>;
    };

    return (
        <Box>
            <Paper elevation={3} sx={{ p: 2, mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" component="span" sx={{ fontWeight: 'bold' }}>
                    Nota Final
                </Typography>
                <Typography variant="h4" component="span" sx={{ fontWeight: 'bold' }}>
                    {`${totalScore} / ${maxScore}`}
                </Typography>
            </Paper>
            
            {sections.map((section, sectionIndex) => (
                <Accordion key={sectionIndex} defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h6">{section.title}</Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ bgcolor: 'grey.50' }}>
                        {section.criteria.map((item, itemIndex) => (
                            <Box key={itemIndex} sx={{ mb: 1.5 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {getStatusIcon(item.awardedPoints, item.maxPoints)}
                                        <Typography>{item.text}</Typography>
                                    </Box>
                                    <Chip 
                                        label={`${item.awardedPoints} / ${item.maxPoints}`}
                                        variant="outlined"
                                        size="small"
                                    />
                                </Box>
                                {item.justification && (
                                    <Typography variant="caption" sx={{ pl: 4, color: 'text.secondary', fontStyle: 'italic' }}>
                                        {`(${item.justification})`}
                                    </Typography>
                                )}
                                {itemIndex < section.criteria.length - 1 && <Divider sx={{ mt: 1.5 }} />}
                            </Box>
                        ))}
                    </AccordionDetails>
                </Accordion>
            ))}

            <Paper elevation={3} sx={{ p: 2, mt: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Resumo da Análise
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap' }}>
                    {summary || 'Nenhum resumo fornecido.'}
                </Typography>
            </Paper>
        </Box>
    );
};

export default EvaluationDetails;