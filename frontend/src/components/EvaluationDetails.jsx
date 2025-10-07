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
        <Typography sx={{ mt: 1 }}>
          {summary || 'Não foi possível carregar os detalhes desta avaliação.'}
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 2, textAlign: 'center' }}>
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