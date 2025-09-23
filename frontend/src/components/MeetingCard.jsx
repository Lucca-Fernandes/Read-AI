import React, { useState } from 'react';
import {
    Card, CardContent, Typography, Box, Chip, Tooltip, IconButton, Collapse, Divider,
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import TopicIcon from '@mui/icons-material/Topic';
import SentimentSatisfiedIcon from '@mui/icons-material/SentimentSatisfied';
import DescriptionIcon from '@mui/icons-material/Description';
import MicIcon from '@mui/icons-material/Mic';
import GroupIcon from '@mui/icons-material/Group';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LinkIcon from '@mui/icons-material/Link';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import EvaluationDetails from './EvaluationDetails';

const MeetingCard = ({ meeting }) => {
    const [expanded, setExpanded] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    const getStatusColor = (score) => {
        if (score === -1) return 'default';
        if (score === 0) return 'error';
        if (score >= 80) return 'success';
        if (score > 0 && score <= 50) return 'warning';
        return 'primary';
    };

    const getScoreLabel = (score) => {
        if (score === null) return 'Avaliando...';
        if (score === -1) return 'Falha na Avaliação';
        if (score === 0) return 'Não Realizada';
        return `Nota: ${score}`;
    };

    const handleScoreClick = () => {
        if (meeting && meeting.score !== null) {
            setModalOpen(true);
        }
    };

    const handleCloseModal = () => {
        setModalOpen(false);
    };

    return (
        <Tooltip title={`ID da Sessão: ${meeting.session_id}`}>
            <Card sx={{ /* ... estilos ... */ }}>
                <CardContent>
                    {/* ... JSX do CardContent ... */}
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
                        {/* A prop `evaluationText` é usada aqui, conforme seu código original */}
                        <EvaluationDetails evaluationText={meeting.evaluationText} />
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