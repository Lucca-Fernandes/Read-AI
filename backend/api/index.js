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

// Configuração de CORS para permitir acesso do seu frontend
const allowedOrigins = [
    'http://localhost:5173', // Para desenvolvimento local
    process.env.FRONTEND_URL  // Para o site em produção (Vercel)
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

const evaluateMeetingWithGemini = async (meeting) => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

        // --- PROMPT ATUALIZADO ---
        // A instrução para a "Nota Geral" agora é muito mais específica e imperativa.
        const prompt = `
            Você é um especialista em análise de qualidade de atendimento e monitoria.
            Sua tarefa é avaliar a gravação de uma reunião entre um monitor e um especialista.
            O monitor é: ${meeting.owner_name}.
            O título da reunião é: "${meeting.meeting_title}".
            A transcrição completa da conversa está abaixo.

            **Contexto:**
            O objetivo é avaliar a performance do monitor com base em critérios específicos. A análise deve ser justa, imparcial e construtiva.

            **Transcrição:**
            ---
            ${meeting.transcript}
            ---

            **Sua Tarefa:**

            1.  **Análise Detalhada por Critérios:**
                Forneça uma análise detalhada com pontuações para cada um dos seguintes critérios. Seja rigoroso e justifique brevemente as pontuações que não forem máximas.
                O formato de cada item deve ser: "- Nome do Critério: nota/máximo (justificativa se necessário)".
                Se um critério for totalmente atendido, pode omitir a justificativa.
                Se um critério não for aplicável, atribua 0 e justifique.

                **Seção: Abertura e Conexão (Rapport)**
                - Abertura da reunião e quebra-gelo: 10/10
                - Demonstração de empatia e escuta ativa: 10/10
                - Alinhamento de expectativas e objetivos da reunião: 10/10

                **Seção: Condução e Análise**
                - Clareza na comunicação e objetividade: 20/20
                - Qualidade e profundidade do feedback fornecido: 20/20
                - Uso de exemplos práticos e dados para embasar a análise: 10/10

                **Seção: Encerramento e Próximos Passos**
                - Postura construtiva e incentivo ao desenvolvimento: 10/10
                - Definição de planos de ação e próximos passos: 10/10

            2.  **Resumo da Análise:**
                Após a análise por critérios, escreva um parágrafo conciso com o título "**Resumo da Análise**", fornecendo um feedback geral sobre a performance do monitor, destacando pontos fortes e oportunidades de melhoria.

            3.  **Nota Geral:**
                Ao final de toda a sua resposta, forneça a nota geral.
                **IMPORTANTE: A nota geral DEVE ser um número único representando a SOMA EXATA dos pontos atribuídos nos critérios detalhados. Não é uma nota subjetiva, é o resultado do cálculo matemático da soma dos pontos que você atribuiu.**

            **Formato de Saída Esperado (Exemplo Fictício):**

            **Abertura e Conexão (Rapport)**
            - Abertura da reunião e quebra-gelo: 8/10 (A abertura foi um pouco direta demais)
            - Demonstração de empatia e escuta ativa: 10/10
            - Alinhamento de expectativas e objetivos da reunião: 10/10

            **Condução e Análise**
            - Clareza na comunicação e objetividade: 18/20 (Houve um momento de divagação)
            - Qualidade e profundidade do feedback fornecido: 20/20
            - Uso de exemplos práticos e dados para embasar a análise: 8/10

            **Encerramento e Próximos Passos**
            - Postura construtiva e incentivo ao desenvolvimento: 10/10
            - Definição de planos de ação e próximos passos: 9/10 (Os próximos passos poderiam ser mais específicos)

            **Resumo da Análise**
            O monitor demonstrou excelente domínio do conteúdo e forneceu feedbacks profundos. A comunicação foi clara na maior parte do tempo. O principal ponto de melhoria é ser mais específico na definição dos planos de ação para garantir a evolução do especialista.

            93
        `;


        const result = await model.generateContent(prompt);
        const responseText = await result.response.text();

        const lines = responseText.trim().split('\n');
        // A última linha é sempre a nota, conforme instruído no prompt
        const scoreLine = lines.pop(); 
        const score = parseInt(scoreLine, 10);
        // O resto do texto é a avaliação detalhada
        const evaluationText = lines.join('\n').trim();

        return {
            score: isNaN(score) ? -1 : score, // Retorna -1 se a nota não for um número
            evaluationText: evaluationText || "A avaliação não pôde ser gerada."
        };

    } catch (error) {
        console.error("Erro ao avaliar com Gemini:", error);
        return {
            score: -1,
            evaluationText: `Falha ao processar a avaliação. Motivo: ${error.message}`
        };
    }
};

// Autenticação de token (middleware)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401); // Unauthorized

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Forbidden
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado. Rota apenas para administradores.' });
    }
    next();
};

app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    try {
        const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: 'Usuário já cadastrado com este e-mail.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // O primeiro usuário a se registrar será um admin
        const usersCount = await pool.query('SELECT COUNT(*) FROM users');
        const role = usersCount.rows[0].count === '0' ? 'admin' : 'user';

        const newUser = await pool.query(
            'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
            [name, email, hashedPassword, role]
        );

        res.status(201).json(newUser.rows[0]);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao registrar usuário.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Credenciais inválidas.' });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Credenciais inválidas.' });
        }

        const token = jwt.sign(
            { id: user.id, name: user.name, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '3h' }
        );

        res.json({ token, user: { name: user.name, email: user.email, role: user.role } });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Nenhum usuário encontrado com este e-mail.' });
        }
        
        const user = userResult.rows[0];
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hora

        await pool.query(
            'UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3',
            [token, expires, user.id]
        );

        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;

        const mailOptions = {
            to: user.email,
            from: process.env.EMAIL_USER,
            subject: 'Redefinição de Senha - Painel de Análises',
            text: `Você está recebendo este e-mail porque você (ou outra pessoa) solicitou a redefinição da senha da sua conta.\n\n` +
                  `Por favor, clique no link a seguir ou cole-o em seu navegador para concluir o processo:\n\n` +
                  `${resetUrl}\n\n` +
                  `Se você não solicitou isso, por favor, ignore este e-mail e sua senha permanecerá inalterada.\n`,
        };

        await transporter.sendMail(mailOptions);
        res.json({ message: 'Um e-mail de redefinição de senha foi enviado.' });

    } catch (err) {
        console.error('Erro no forgot-password:', err);
        res.status(500).json({ error: 'Erro ao enviar e-mail de redefinição.' });
    }
});

app.post('/api/reset-password/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        const userResult = await pool.query(
            'SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > NOW()',
            [token]
        );

        if (userResult.rows.length === 0) {
            return res.status(400).json({ error: 'O token de redefinição de senha é inválido ou expirou.' });
        }

        const user = userResult.rows[0];
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await pool.query(
            'UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2',
            [hashedPassword, user.id]
        );
        
        res.json({ message: 'Sua senha foi redefinida com sucesso.' });

    } catch (err) {
        console.error('Erro no reset-password:', err);
        res.status(500).json({ error: 'Erro ao redefinir a senha.' });
    }
});


app.get('/api/meetings', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let query = 'SELECT * FROM meetings';
        const queryParams = [];

        if (startDate && endDate) {
            query += ' WHERE start_time::date BETWEEN $1 AND $2';
            queryParams.push(startDate, endDate);
        }
        
        query += ' ORDER BY start_time DESC';

        const { rows } = await pool.query(query, queryParams);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar reuniões.' });
    }
});

app.post('/api/refresh-meetings', authenticateToken, isAdmin, async (req, res) => {
    try {
        const firefliesResponse = await axios.get('https://api.fireflies.ai/graphql', {
            headers: { 'Authorization': `Bearer ${process.env.FIREFLIES_API_KEY}` },
            data: { query: `{ transcripts { id title date duration transcript_url participants { name } } }` }
        });

        const transcripts = firefliesResponse.data.data.transcripts;

        if (!transcripts) {
            return res.status(404).json({ message: "Nenhuma transcrição encontrada na API do Fireflies." });
        }

        const last30Days = new Date();
        last30Days.setDate(last30Days.getDate() - 30);

        const recentTranscripts = transcripts.filter(t => new Date(t.date) > last30Days);

        const { rows } = await pool.query('SELECT session_id FROM meetings');
        const existingIds = rows.map(r => r.session_id);

        const newMeetingsRaw = recentTranscripts.filter(t => !existingIds.includes(t.id));

        const newMeetings = await Promise.all(newMeetingsRaw.map(async (t) => {
            const transcriptResponse = await axios.get(t.transcript_url);
            const detailedTranscript = transcriptResponse.data.transcript;
            const owner = transcriptResponse.data.user;

            return {
                session_id: t.id,
                meeting_title: t.title,
                owner_name: owner?.name || 'Não identificado',
                summary: 'Resumo a ser gerado',
                topics: [],
                sentiments: 'neutro',
                chapters: [],
                transcript: detailedTranscript,
                participants: t.participants,
                start_time: new Date(t.date).toISOString(),
                report_url: `https://app.fireflies.ai/view/${t.id}`
            };
        }));
        
        if (newMeetings.length === 0) {
            return res.json({ message: 'Nenhuma reunião nova para adicionar.' });
        }

        const evaluated = await Promise.all(newMeetings.map(async (m) => {
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

// A Vercel gerencia a porta, então não precisamos mais de app.listen
module.exports = app;