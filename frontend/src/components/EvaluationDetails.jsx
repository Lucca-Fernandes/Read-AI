import React from 'react';
import {
  Box, Typography, Chip, Accordion, AccordionSummary,
  AccordionDetails, Paper, Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import InfoIcon from '@mui/icons-material/Info';
import GppBadIcon from '@mui/icons-material/GppBad';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import ScoreboardIcon from '@mui/icons-material/Scoreboard';

const getScoreStatus = (awarded) => {
  if (awarded < 0) return 'error';
  if (awarded === 0) return 'error';
  if (awarded > 0) return 'success';
  return 'default';
};

const StatusIcon = ({ status }) => {
  const icons = {
    success: <CheckCircleIcon color="success" />,
    error: <CancelIcon color="error" />,
  };
  return icons[status] || <InfoIcon color="disabled" />;
};

const EvaluationDetails = ({ evaluationData }) => {
  // Se não houver dados estruturados, exibe uma mensagem de erro.
  if (!evaluationData || !evaluationData.sections || evaluationData.sections.length === 0) {
    return (
      <Paper elevation={2} sx={{ p: 2, mt: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="error">Falha na Análise</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Não foi possível processar o detalhe desta avaliação. O formato da resposta da IA pode ter sido irreconhecível.
        </Typography>
      </Paper>
    );
  }

  const { sections, summary, finalScore } = evaluationData;

  return (
    <Box>
      <Paper elevation={2} sx={{ p: 2, mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ScoreboardIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Nota Final</Typography>
        </Box>
        <Chip label={finalScore} color={finalScore >= 80 ? 'success' : finalScore > 50 ? 'primary' : 'error'} sx={{ fontSize: '1rem', fontWeight: 'bold' }} />
      </Paper>

      {sections.map((section, index) => {
        const sectionScore = section.criteria.reduce((sum, item) => sum + item.awardedPoints, 0);
        
        return (
          <Accordion key={index} defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                  {section.title}
                </Typography>
                <Chip label={`${sectionScore} pts`} size="small" />
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 1.5, bgcolor: 'action.hover' }}>
              {section.criteria.map((item, itemIndex) => {
                const isReducer = item.awardedPoints < 0;
                const status = getScoreStatus(item.awardedPoints);
                return (
                  <Box key={itemIndex} sx={{ mb: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {isReducer ? <GppBadIcon color="error" /> : <StatusIcon status={status} />}
                        <Typography variant="body2">{item.text}</Typography>
                      </Box>
                      <Chip label={item.awardedPoints} color={status} size="small" />
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
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Resumo da Análise</Typography>
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap' }}>
          {summary || 'Nenhum resumo fornecido.'}
        </Typography>
      </Paper>
    </Box>
  );
};

export default EvaluationDetails;