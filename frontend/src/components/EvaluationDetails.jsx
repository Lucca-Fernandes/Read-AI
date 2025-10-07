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

// =======================================================================
// VERSÃO FINAL DA FUNÇÃO parseEvaluationText
// =======================================================================
const parseEvaluationText = (text) => {
    if (!text || typeof text !== 'string') {
        return { sections: [], summary: 'Texto de avaliação inválido ou ausente.', finalScore: 0 };
    }

    // 1. Extrai a Nota Final (procura por múltiplos padrões)
    let finalScore = 0;
    const scoreMatchers = [
        /^FINAL_SCORE:\s*(\d+)/m,
        /Score Final:\s*.*?=\s*\**(\d+)\**/m,
        /Score Final Total:\s*.*?=\s*\**(\d+)\**/m,
        /^\*\*Score Final:\*\*\s*(\d+)/m
    ];
    for (const matcher of scoreMatchers) {
        const scoreMatch = text.match(matcher);
        if (scoreMatch) {
            finalScore = parseInt(scoreMatch[1], 10);
            break;
        }
    }

    // 2. Extrai o Resumo
    let summary = 'Resumo não encontrado.';
    const summarySplit = text.split(/\*\*Resumo da Análise:\*\*/m);
    if (summarySplit.length > 1) {
        summary = summarySplit[1].split(/---|\*\*Score Final|FINAL_SCORE/m)[0].trim();
    }

    if (text.toLowerCase().includes("não foi realizada")) {
        return { sections: [], summary: text, finalScore: 0 };
    }

    // 3. Processa as seções e critérios do bloco de texto ANTES do resumo
    const detailsBlock = summarySplit[0];
    const lines = detailsBlock.split('\n').map(line => line.trim());

    const sections = [];
    let currentSection = null;
    let lastCriterion = null;

    // Cria uma seção padrão para agrupar critérios que aparecem antes de um cabeçalho de seção formal
    const defaultSection = { title: "Critérios Gerais", criteria: [] };
    sections.push(defaultSection);
    currentSection = defaultSection;

    const sectionRegex = /^\*\*\s*\d+\.\s*(.*?)\s*\(Peso Total: \d+ pontos\)\*\*/;
    const criterionRegex = /^\s*-\s*(.*?)\s*\((\d+)\s*pontos\):\s*(-?\d+)/;
    const evidenceRegex = /^(?:- Evidência:|\*Justificativa\*:)\s*(.*)/i;

    for (const line of lines) {
        const sectionMatch = line.match(sectionRegex);
        if (sectionMatch) {
            // Se encontrarmos uma seção de verdade, a criamos e a tornamos a seção atual
            const newSection = { title: sectionMatch[1].trim(), criteria: [] };
            sections.push(newSection);
            currentSection = newSection;
            lastCriterion = null;
            continue;
        }

        const criterionMatch = line.match(criterionRegex);
        if (criterionMatch) {
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

    // Limpa seções que possam ter sido criadas mas permaneceram vazias
    const finalSections = sections.filter(s => s.criteria.length > 0);

    if (finalSections.length === 0) {
        return { 
            sections: [], 
            summary: summary !== 'Resumo não encontrado.' ? summary : `(Formato não reconhecido):\n\n${text}`, 
            finalScore: finalScore 
        };
    }

    return { sections: finalSections, summary, finalScore };
};


const getScoreColor = (score) => {
  if (score >= 80) return 'success';
  if (score > 50) return 'primary';
  return 'error';
};

const EvaluationDetails = ({ evaluationText }) => {
  const { sections, summary, finalScore } = useMemo(() => parseEvaluationText(evaluationText), [evaluationText]);

  if (sections.length === 0) {
    return (
      <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
        <InfoIcon color="action" sx={{ fontSize: 40, mb: 1 }} />
        <Typography variant="h6">Informação da Reunião</Typography>
        <Typography sx={{ mt: 1, whiteSpace: 'pre-wrap', fontFamily: 'monospace', bgcolor: 'grey.100', p: 1, borderRadius: 1 }}>
          {summary || 'Não foi possível carregar os detalhes desta avaliação.'}
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={7}>
            <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
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
        </Grid>
        <Grid item xs={12} md={5}>
            <Paper elevation={2} sx={{ p: 2, textAlign: 'center', height: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mb: 1 }}>
                    <ScoreboardIcon color={getScoreColor(finalScore)} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Nota Final</Typography>
                </Box>
                <Typography variant="h3" color={getScoreColor(finalScore) + '.main'} sx={{ fontWeight: 'bold' }}>
                    {finalScore}
                    <Typography variant="h5" component="span" color="text.secondary"> / 100</Typography>
                </Typography>
            </Paper>
        </Grid>
      </Grid>
      
      {sections.map((section, index) => {
        const sectionScore = section.criteria.reduce((acc, item) => acc + Number(item.awardedPoints), 0);
        const maxScore = section.criteria.reduce((acc, item) => acc + Number(item.maxPoints), 0);
        
        return (
          <Accordion key={index} defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography sx={{ flexGrow: 1, fontWeight: 'bold' }}>
                {section.title}
              </Typography>
              <Chip label={`${sectionScore} / ${maxScore}`} size="small" />
            </AccordionSummary>
            <AccordionDetails sx={{ bgcolor: 'white' }}>
              {section.criteria.map((item, itemIndex) => {
                const status = getScoreStatus(Number(item.awardedPoints), Number(item.maxPoints));
                const isReducer = Number(item.awardedPoints) < 0;

                return (
                  <Box key={itemIndex} sx={{ py: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1, mr: 1 }}>
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
    </Box>
  );
};

export default EvaluationDetails;