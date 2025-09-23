require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());


const allowedOrigins = [
    'http://localhost:5173',
    process.env.FRONTEND_URL
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));


const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 👇 ALTERAÇÃO 1: NOVA FUNÇÃO PARA CALCULAR A NOTA CORRETAMENTE 👇
/**
 * Analisa o texto da avaliação gerado pela IA e soma os pontos de cada critério.
 * Esta função é a réplica da lógica que existe no frontend (modal).
 * @param {string} text O texto completo da avaliação.
 * @returns {number} A soma total dos pontos dos critérios.
 */
const calculateScoreFromEvaluation = (text) => {
    if (!text || typeof text !== 'string') {
        return 0; // Retorna 0 se o texto for inválido
    }

    let totalScore = 0;
    // Esta expressão regular procura por padrões como "- Critério... (10/10)"
    // e captura apenas o primeiro número (os pontos ganhos).
    const criteriaRegex = /- .*?\((\d+)\/\d+\)/g;
    
    let match;
    // Itera sobre todas as correspondências encontradas no texto
    while ((match = criteriaRegex.exec(text)) !== null) {
        // match[1] contém o número capturado (os pontos).
        // Convertemos para inteiro e somamos ao total.
        totalScore += parseInt(match[1], 10);
    }
    
    // Se nenhum critério for encontrado, a nota será 0, o que é mais seguro
    // do que retornar -1 (indicador de erro).
    return totalScore;
};


async function evaluateMeetingWithGemini(meeting) {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `
        Você é um avaliador de atendimento que analisa transcrições de reuniões entre monitores e clientes.
        Sua tarefa é avaliar o desempenho do monitor com base na transcrição fornecida.
        Analise a seguinte transcrição:
        ---
        ${meeting.transcript}
        ---
        Avalie o desempenho do monitor nos seguintes critérios, atribuindo uma pontuação para cada um.
        Seja rigoroso e justo. Forneça uma justificativa curta para cada nota.
        A estrutura da sua resposta DEVE seguir este formato de Markdown:

        **Abertura (Máx: 10)**
        - Cumpriu o script inicial de boas-vindas? (5/5)
        - Apresentou-se corretamente? (5/5)

        **Sondagem (Máx: 20)**
        - Fez perguntas abertas para entender a necessidade do cliente? (10/10)
        - Demonstrou escuta ativa? (10/10)

        **Solução (Máx: 30)**
        - Apresentou a solução de forma clara e objetiva? (15/15)
        - A solução atendia à necessidade do cliente? (15/15)

        **Manejo de Objeções (Máx: 20)**
        - Conseguiu contornar as objeções do cliente? (10/10)
        - Manteve a calma e a cordialidade? (10/10)

        **Encerramento (Máx: 20)**
        - Resumiu o que foi acordado? (10/10)
        - Seguiu o script de encerramento? (10/10)

        **Redutores**
        - Usou termos técnicos desnecessários? (-5/0)
        - Interrompeu o cliente? (-5/0)

        **Resumo da Análise**
        [Escreva aqui um breve parágrafo resumindo os pontos fortes e fracos do atendimento.]
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const evaluationText = response.text();

        // 👇 ALTERAÇÃO 2: USANDO A NOVA FUNÇÃO DE CÁLCULO 👇
        // Removemos a busca pela "Nota Final" no texto e agora calculamos a nota
        // somando os pontos dos critérios, garantindo consistência.
        const score = calculateScoreFromEvaluation(evaluationText);

        return { score, evaluationText };

    } catch (error) {
        console.error("Erro ao chamar a API Gemini:", error);
        // Em caso de erro com a IA, retornamos um texto de falha e uma nota -1.
        return {
            score: -1,
            evaluationText: "Falha ao processar avaliação com a IA."
        };
    }
}

// Rota de autenticação de login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (isMatch) {
                const token = jwt.sign({ userId: user.id, name: user.name, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
                res.json({ token, user: { name: user.name, email: user.email } });
            } else {
                res.status(401).json({ error: 'Credenciais inválidas.' });
            }
        } else {
            res.status(401).json({ error: 'Credenciais inválidas.' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

// Rota para criação de usuário
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        await pool.query(
            'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)',
            [name, email, passwordHash]
        );
        res.status(201).json({ message: 'Usuário criado com sucesso!' });
    } catch (err) {
        if (err.code === '23505') { // Código de violação de unicidade do PostgreSQL
            return res.status(400).json({ error: 'O e-mail informado já está em uso.' });
        }
        console.error(err);
        res.status(500).json({ error: 'Erro ao criar usuário.' });
    }
});

// Rota para solicitar reset de senha
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        
        const user = userResult.rows[0];
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hora

        await pool.query(
            'UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3',
            [token, expires, user.id]
        );
        
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS
            }
        });
        
        const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;

        await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: user.email,
            subject: 'Recuperação de Senha - Painel de Análises',
            html: `<p>Você solicitou a recuperação de senha. Clique neste <a href="${resetLink}">link</a> para redefinir sua senha. O link expira em 1 hora.</p>`
        });

        res.json({ message: 'E-mail de recuperação enviado com sucesso!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao processar a solicitação.' });
    }
});

// Rota para efetivar o reset de senha
app.post('/api/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;
    try {
        const userResult = await pool.query(
            'SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > NOW()',
            [token]
        );

        if (userResult.rows.length === 0) {
            return res.status(400).json({ error: 'Token inválido ou expirado.' });
        }

        const user = userResult.rows[0];
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        await pool.query(
            'UPDATE users SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2',
            [passwordHash, user.id]
        );

        res.json({ message: 'Senha redefinida com sucesso!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao redefinir a senha.' });
    }
});


// Middleware para proteger rotas
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

app.get('/api/meetings', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM meetings ORDER BY start_time DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar reuniões.' });
    }
});

app.get('/api/refresh-meetings', authenticateToken, async (req, res) => {
    try {
        const response = await axios.get('https://api.zoom.us/v2/users/me/recordings', {
            headers: { 'Authorization': `Bearer ${process.env.ZOOM_JWT}` },
            params: {
                from: '2024-01-01',
                page_size: 50
            }
        });

        const allMeetings = response.data.meetings;
        const dbResult = await pool.query('SELECT session_id FROM meetings');
        const existingIds = dbResult.rows.map(r => r.session_id);

        const newMeetings = allMeetings
            .filter(m => !existingIds.includes(m.uuid))
            .map(m => ({
                session_id: m.uuid,
                meeting_title: m.topic,
                owner_name: m.host_email.split('@')[0].replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                summary: '', 
                topics: [],
                sentiments: '',
                chapters: [],
                transcript: '', 
                participants: [],
                start_time: m.start_time,
                report_url: m.share_url,
                score: 0,
                evaluation_text: ''
            }));
        
        if (newMeetings.length === 0) {
            return res.json({ message: 'Nenhuma nova reunião para adicionar.' });
        }

        for(let meeting of newMeetings) {
            try {
                const detailsResponse = await axios.get(`https://api.zoom.us/v2/meetings/${meeting.session_id}/recordings`, {
                    headers: { 'Authorization': `Bearer ${process.env.ZOOM_JWT}` }
                });
                
                const audioFile = detailsResponse.data.recording_files.find(f => f.file_type === 'M4A' || f.recording_type === 'audio_only');
                if (audioFile) {
                    const transcriptResponse = await axios.get(audioFile.play_url.replace('https://us02web.zoom.us/rec/play/', 'https://ssrweb.zoom.us/v2/rec/play/'), {
                        headers: { 'Authorization': `Bearer ${process.env.ZOOM_JWT}` }
                    });
                    
                    if(transcriptResponse.data.transcripts) {
                       meeting.transcript = transcriptResponse.data.transcripts.map(t => t.text).join(' ');
                    }
                }
            } catch (err) {
                console.error(`Erro ao buscar detalhes para a reunião ${meeting.session_id}:`, err.response ? err.response.data : err.message);
            }
        }

        const meetingsToEvaluate = newMeetings.filter(m => m.transcript);
        const evaluated = await Promise.all(meetingsToEvaluate.map(async (m) => {
            const { score, evaluationText } = await evaluateMeetingWithGemini(m);
            return { ...m, score, evaluation_text: evaluationText };
        }));

        for (const m of evaluated) {
            await pool.query(`
                INSERT INTO meetings (
                    session_id, meeting_title, owner_name, summary, topics, sentiments,
                    chapters, transcript, participants, start_time, report_url, score, evaluation_text
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            `, [
                m.session_id, m.meeting_title, m.owner_name, m.summary,
                JSON.stringify(m.topics || []),
                m.sentiments,
                JSON.stringify(m.chapters || []),
                m.transcript,
                JSON.stringify(m.participants || []),
                m.start_time, m.report_url, m.score, m.evaluation_text
            ]);
        }
        res.json({ message: `Adicionadas ${evaluated.length} novas reuniões.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao atualizar reuniões.' });
    }
});

module.exports = app;