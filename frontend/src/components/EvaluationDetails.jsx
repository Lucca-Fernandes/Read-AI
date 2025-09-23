// CONTEÚDO COMPLETO DO frontend/src/components/EvaluationDetails.jsx

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
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import InfoIcon from '@mui/icons-material/Info';
import GppBadIcon from '@mui/icons-material/GppBad';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import ScoreboardIcon from '@mui/icons-material/Scoreboard';

const getScoreStatus = (awarded, max) => {
  if (awarded < 0) return 'error';
  if (awarded === 0) return 'error';
  if (awarded === max) return 'success';
  if (awarded > 0) return 'warning';
  return 'default';
};

const StatusIcon = ({ status }) => {
  const icons = {
    success: <CheckCircleIcon color="success" />,
    error: <CancelIcon color="error" />,
    warning: <InfoIcon color="warning" />,
  };
  return icons[status] || <InfoIcon color="disabled" />;
};

// Esta função agora apenas extrai as seções e o resumo para exibição.
// O CÁLCULO DA NOTA FOI REMOVIDO DAQUI.
const parseEvaluationTextForDisplay = (text) => {
  if (!text || typeof text !== 'string') {
    return { sections: [], summary: 'Texto de avaliação ausente ou inválido.' };
  }

  try {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const sections = [];
    let currentSection = null;
    let summary = '';

    const summaryRegex = /\*\*Resumo da Análise:\*\*([\s\S]*)/;
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
      }
    });

    if (currentSection) sections.push(currentSection);
    return { sections, summary };

  } catch (error) {
    console.error("Falha ao parsear texto para exibição:", error);
    return { sections: [], summary: 'Erro ao processar o texto da avaliação.' };
  }
};


const EvaluationDetails = ({ meeting }) => {
  // O componente agora recebe o objeto 'meeting' inteiro
  const { evaluationText, score } = meeting;

  const { sections, summary } = useMemo(() => parseEvaluationTextForDisplay(evaluationText), [evaluationText]);

  const getOverallStatusColor = (score) => {
    if (score >= 80) return 'success';
    if (score >= 50) return 'primary';
    if (score > 0) return 'warning';
    return 'error';
  };

  if (!evaluationText) {
    return <Typography>Não há detalhes de avaliação para esta reunião.</Typography>;
  }
  
  return (
    <Box>
      <Paper elevation={2} sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
        <Grid container alignItems="center" justifyContent="center" spacing={2}>
          <Grid item>
            <ScoreboardIcon sx={{ fontSize: '3rem', color: `${getOverallStatusColor(score)}.main` }}/>
          </Grid>
          <Grid item>
            <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 'medium' }}>
              Nota Final
            </Typography>
            <Typography variant="h3" component="p" sx={{ fontWeight: 'bold', color: `${getOverallStatusColor(score)}.main`, lineHeight: 1.2 }}>
              {/* A nota agora vem diretamente do backend, garantindo consistência */}
              {score}
            </Typography>
          </Grid>
        </Grid>
      </Paper>
      
      {sections.map((section, sectionIndex) => (
        <Accordion key={sectionIndex} defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 'bold' }}>{section.title}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ bgcolor: 'grey.100', p: 1.5 }}>
              {section.criteria.map((item, itemIndex) => {
                const isReducer = item.awardedPoints < 0;
                const status = getScoreStatus(item.awardedPoints, item.maxPoints);
                return (
                  <Box key={itemIndex} sx={{ mb: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
                        {isReducer ? <GppBadIcon color="error" /> : <StatusIcon status={status} />}
                        <Typography variant="body2">{item.text}</Typography>
                      </Box>
                      <Chip 
                        label={item.awardedPoints} 
                        color={status}
                        size="small"
                      />
                    </Box>
                    {item.justification && (
                      <Typography variant="caption" sx={{ pl: '28px', color: 'text.secondary', fontStyle: 'italic' }}>
                        {`(${item.justification})`}
                      </Typography>
                    )}
                    {itemIndex < section.criteria.length - 1 && <Divider sx={{ mt: 1.5 }} />}
                  </Box>
                );
              })}
            </AccordionDetails>
        </Accordion>
      ))}

      <Paper elevation={2} sx={{ p: 2, mt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <TextSnippetIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Resumo da Análise
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap' }}>
          {summary || 'Nenhum resumo fornecido.'}
        </Typography>
      </Paper>
    </Box>
  );
};

export default EvaluationDetails;