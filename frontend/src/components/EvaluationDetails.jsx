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
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import ScoreboardIcon from '@mui/icons-material/Scoreboard';

// --- HELPERS VISUAIS ---
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

// --- PARSER INTELIGENTE ---
const parseEvaluationText = (text, dbScore) => {
  if (!text || typeof text !== 'string') {
    return { sections: [], summary: 'Texto de avaliação inválido ou ausente.', finalScore: dbScore || 0, rawText: null };
  }

  try {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const sections = [];
    let currentSection = null;
    let extractedSummary = '';

    // 1. Extração do Resumo
    const summaryRegex = /\*\*Resumo da Análise:\*\*([\s\S]*?)(?=(?:FINAL_SCORE:|CRITÉRIOS|\d+\.|[*]{2}))/i;
    const summaryMatch = text.match(summaryRegex);
    if (summaryMatch) {
      extractedSummary = summaryMatch[1].trim();
    } else {
       extractedSummary = text.substring(0, 250) + "...";
    }

    // 2. Loop pelas linhas para montar as seções
    lines.forEach(line => {
      const cleanLine = line.trim();

      // PADRÃO DE CABEÇALHO (Ex: "1. **Progresso (50 pts):**")
      const headerRegex = /(?:^\d+\.|^[*]+)?\s*\**([A-Za-zÀ-ÿ\s]+?)\s*\**\s*\(\s*(\d+)\s*(?:pts|pontos|Peso Total: \d+)\s*\)\s*\**:?/i;
      const headerMatch = cleanLine.match(headerRegex);

      if (headerMatch) {
        if (currentSection) sections.push(currentSection);
        currentSection = { 
          title: headerMatch[1].trim(), 
          maxPoints: parseInt(headerMatch[2], 10), 
          criteria: [] 
        };
        return;
      }
      
      // PADRÃO DE CRITÉRIO (Ex: "* **Semana do aluno (5/5):** Texto...")
      const criteriaSlashRegex = /^[\*\-]\s*\**([^\(]+?)\s*\**\s*\(\s*(\d+)\s*[\/]\s*(\d+)\s*\)\s*\**:\s*(.*)/i;
      const slashMatch = cleanLine.match(criteriaSlashRegex);

      if (slashMatch && currentSection) {
        currentSection.criteria.push({
          text: slashMatch[1].trim(),
          maxPoints: parseInt(slashMatch[3], 10),
          awardedPoints: parseInt(slashMatch[2], 10),
          justification: slashMatch[4].trim()
        });
        return;
      }

      // Caso 2: Formato Antigo "Critério (Max pontos): Nota"
      const criteriaOldRegex = /^[\*\-]\s*(.*?)\s*\((\d+|Máximo: -?\d+)\s*pontos\):\s*(-?\d+)\s*(?:\((.*?)\))?/i;
      const oldMatch = cleanLine.match(criteriaOldRegex);

      if (oldMatch && currentSection) {
         currentSection.criteria.push({
          text: oldMatch[1].trim(),
          maxPoints: parseInt(String(oldMatch[2]).replace('Máximo: ', ''), 10),
          awardedPoints: parseInt(oldMatch[3], 10),
          justification: (oldMatch[4] || '').trim(),
        });
        return;
      }
    });

    if (currentSection) sections.push(currentSection);

    if (sections.length === 0) {
        return { sections: [], summary: extractedSummary, finalScore: dbScore || 0, rawText: text };
    }

    const calculatedScore = sections.reduce((total, section) => {
      return total + section.criteria.reduce((sectionSum, crit) => sectionSum + crit.awardedPoints, 0);
    }, 0);

    const finalScoreToUse = (calculatedScore === 0 && dbScore) ? dbScore : calculatedScore;

    return { sections, summary: extractedSummary, finalScore: finalScoreToUse, rawText: null };

  } catch (error) {
    console.error("Erro no parser:", error);
    return { sections: [], summary: 'Erro visualização.', finalScore: dbScore || 0, rawText: text };
  }
};

// --- COMPONENTE PRINCIPAL ---
const EvaluationDetails = ({ evaluationText, dbScore }) => {
  const { sections, summary, finalScore, rawText } = useMemo(
    () => parseEvaluationText(evaluationText, dbScore), 
    [evaluationText, dbScore]
  );

  if (rawText) {
    return (
        <Box>
            <Paper elevation={2} sx={{ p: 2, mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#fff3e0' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InfoIcon color="warning" />
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                        Nota Final (Detalhes visuais indisponíveis)
                    </Typography>
                </Box>
                <Chip label={finalScore} color="primary" sx={{ fontSize: '1.2rem', fontWeight: 'bold', p: 2 }} />
            </Paper>
            <Paper elevation={1} sx={{ p: 2 }}>
                <Typography sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                    {rawText}
                </Typography>
            </Paper>
        </Box>
    );
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
        
        return (
          <Accordion key={index} defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Grid container alignItems="center" spacing={2}>
                <Grid item xs={12} sm={8}>
                  <Typography sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                    {section.title}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
                  <Chip 
                    label={`Nota: ${totalAwarded} / ${section.maxPoints}`} 
                    size="small"
                    color="primary"
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
                        <StatusIcon status={status} />
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{item.text}</Typography>
                      </Box>
                      <Chip 
                        label={`${item.awardedPoints}/${item.maxPoints}`} 
                        color={status}
                        size="small"
                      />
                    </Box>
                    {item.justification && (
                      <Typography variant="body2" sx={{ pl: '28px', mt: 0.5, color: 'text.secondary' }}>
                        {item.justification}
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