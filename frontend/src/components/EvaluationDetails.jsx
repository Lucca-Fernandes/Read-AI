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

    // Calculate finalScore from summed awardedPoints
    const finalScore = sections.reduce((total, section) => {
      return total + section.criteria.reduce((sectionSum, crit) => sectionSum + crit.awardedPoints, 0);
    }, 0);

    return { sections, summary, finalScore };
  } catch (error) {
    console.error("Falha ao parsear o texto de avaliação:", error);
    // Fallback: Sum scores using regex similar to Dashboard
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

const EvaluationDetails = ({ evaluationText }) => {
  const { sections, summary, finalScore, rawText } = useMemo(
    () => parseEvaluationText(evaluationText), 
    [evaluationText]
  );

  if (rawText) {
    return <Typography sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{rawText}</Typography>;
  }

  return (
    <Box>
      <Paper elevation={2} sx={{ p: 2, mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(45deg, #e3f2fd 30%, #e8eaf6 90%)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ScoreboardIcon color="primary" sx={{ fontSize: '2rem' }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Nota Final
          </Typography>
        </Box>
        <Chip label={finalScore} color="primary" sx={{ fontSize: '1.2rem', fontWeight: 'bold', p: 2 }} />
      </Paper>
      
      {sections.map((section, index) => {
        const totalAwarded = section.criteria.reduce((acc, curr) => acc + curr.awardedPoints, 0);
        const isReducer = section.isReducer;

        return (
          <Accordion key={index} defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Grid container alignItems="center" spacing={2}>
                <Grid item xs={12} sm={8}>
                  <Typography sx={{ fontWeight: 'bold', color: isReducer ? 'error.main' : 'text.primary' }}>
                    {section.title}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
                  <Chip 
                    label={`Nota: ${totalAwarded} / ${section.maxPoints}`} 
                    size="small"
                    color={isReducer ? (totalAwarded < 0 ? 'error' : 'default') : 'primary'}
                    variant="outlined"
                  />
                </Grid>
              </Grid>
            </AccordionSummary>
            <AccordionDetails sx={{ background: '#fafafa' }}>
              {section.criteria.map((item, itemIndex) => {
                const status = getScoreStatus(item.awardedPoints, item.maxPoints);
                return (
                  <Box key={itemIndex} sx={{ mb: itemIndex === section.criteria.length - 1 ? 0 : 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
        );
      })}

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