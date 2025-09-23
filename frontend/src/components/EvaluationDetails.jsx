import React, { useMemo } from 'react';
import {
  Box, Typography, Chip, Accordion, AccordionSummary,
  AccordionDetails, Paper, Divider, Grid,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import InfoIcon from '@mui/icons-material/Info';
import GppBadIcon from '@mui/icons-material/GppBad';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import ScoreboardIcon from '@mui/icons-material/Scoreboard';

// ... (Funções `getScoreStatus` e `StatusIcon` permanecem as mesmas)

const parseEvaluationText = (text) => {
    // ... (A sua função de `parse` original permanece aqui, inalterada)
};

const EvaluationDetails = ({ evaluationText }) => {
    const { sections, summary, finalScore, rawText } = useMemo(
        () => parseEvaluationText(evaluationText), 
        [evaluationText]
    );

    if (rawText) {
        return <Typography sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{rawText}</Typography>;
    }

    if (!sections || sections.length === 0) {
        return (
             <Paper elevation={2} sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h6" color="error">Análise Indisponível</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Não foi possível extrair os critérios detalhados desta avaliação.
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Resumo da IA:</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap', textAlign: 'left', mt: 1 }}>
                    {summary || "Nenhum resumo encontrado."}
                </Typography>
             </Paper>
        )
    }

    return (
        <Box>
            {/* ... (O restante do seu JSX de exibição permanece o mesmo) */}
        </Box>
    );
};

export default EvaluationDetails;