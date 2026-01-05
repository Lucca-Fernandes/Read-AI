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
    process.env.FRONTEND_URL // Vamos criar essa variável de ambiente na Vercel
];

app.use(cors({
    origin: function (origin, callback) {
        // Permite requisições sem 'origin' (como de apps mobile ou Postman) e as da nossa lista.
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
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

// --- FUNÇÕES AUXILIARES ---

// 1. Função Inteligente para Corrigir Datas
const parseDate = (dateStr) => {
    if (!dateStr) return null;
    let cleanStr = String(dateStr).trim();

    // Lógica para serial de Excel
    if (/^\d+(?:[.,]\d+)?$/.test(cleanStr)) {
        const excelSerial = parseFloat(cleanStr.replace(',', '.'));
        if (excelSerial > 30000) {
            return new Date((excelSerial - 25569) * 86400 * 1000);
        }
    }

    // Formato Brasileiro DD/MM/YYYY HH:mm:ss
    const brDateRegex = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):?(\d{2})?)?.*$/;
    const match = cleanStr.match(brDateRegex);

    if (match) {
        return new Date(
            parseInt(match[3]),      // Ano
            parseInt(match[2]) - 1,  // Mês
            parseInt(match[1]),      // Dia
            match[4] ? parseInt(match[4]) : 0, // Hora
            match[5] ? parseInt(match[5]) : 0, // Minuto
            match[6] ? parseInt(match[6]) : 0  // Segundo
        );
    }

    // Tentativa padrão ISO
    const date = new Date(cleanStr);
    return isNaN(date.getTime()) ? null : date;
};

// 2. Parser do Texto do Gemini (CORRIGIDO E OTIMIZADO)
const parseEvaluationText = (text) => {
  if (!text || typeof text !== 'string') return { summary: 'Texto inválido.', finalScore: 0, sentimentScore: 0, engagementScore: 0 };
  
  try {
    // Regex robustas para os 3 scores
    const scoreMatch = text.match(/FINAL_SCORE[\s:*]*(\d+)/i);
    const sentimentMatch = text.match(/SENTIMENT_SCORE[\s:*]*(\d+)/i);
    const engagementMatch = text.match(/ENGAGEMENT_SCORE[\s:*]*(\d+)/i);

    // Extrai o resumo
    const summaryMatch = text.match(/\*\*Resumo da Análise:\*\*([\s\S]*?)(?=(?:FINAL_|SENTIMENT_|ENGAGEMENT_|CRITÉRIOS|1\.|$))/i);
    
    return {
        finalScore: scoreMatch ? parseInt(scoreMatch[1], 10) : 0,
        sentimentScore: sentimentMatch ? parseInt(sentimentMatch[1], 10) : 0,
        engagementScore: engagementMatch ? parseInt(engagementMatch[1], 10) : 0,
        summary: summaryMatch ? summaryMatch[1].trim() : text.substring(0, 200) + "..."
    };
  } catch (error) {
    console.error("Erro no parser:", error);
    return { summary: 'Erro no processamento.', finalScore: 0, sentimentScore: 0, engagementScore: 0 };
  }
};

const evaluateMeetingWithGemini = async (meeting) => {
    if (!meeting.transcript || meeting.transcript.length < 50) {
         return { score: 0, sentimentScore: 0, engagementScore: 0, evaluationText: 'Transcrição insuficiente.' };
    }

    try {
       const prompt = `
--- IDENTIFICAÇÃO DE PAPÉIS (OBRIGATÓRIO) ---
1. MONITOR/AGENTE: ${meeting.owner_name}. Ele conduz, explica e cobra.
2. ALUNO/CLIENTE: O outro participante que recebe a instrução.
O monitor é o instrutor; o aluno é o aprendiz. Não inverta os papéis.

--- MISSÃO DE ANÁLISE ---
Avalie o desempenho do MONITOR e o comportamento do ALUNO com base na transcrição. Seja criterioso. Se algo não foi dito, a nota é zero, exceto onde houver regra de exceção explícita abaixo.

**REGRAS DE PONTUAÇÃO DO MONITOR (Total 100 pts):**

1. PROGRESSO (50 pts): 
   - Validou a semana/rotina (5 pts)
   - Revisou meta anterior (10 pts)
   - Definiu nova meta (10 pts)
   - Explicou/Orientou conteúdo (20 pts)
   - Status de Exercícios (5 pts): O monitor deve PERGUNTAR se o aluno fez ou teve dificuldade nos exercícios. (Nota: Ele não precisa passar novos, apenas monitorar os atuais).

2. QUALIDADE (15 pts):
   - Resolução de Dúvidas (10 pts): 
     * REGRA DE OURO: SE o aluno não apresentou dúvidas, o monitor GANHA os 10 pts pela proatividade. SE o aluno teve dúvida e o monitor não resolveu ou enrolou, a nota é 0.
   - Organização (5 pts): Demonstrou ter um roteiro e controle do tempo.

3. ENGAJAMENTO DO AGENTE (15 pts):
   - Incentivo Positivo (5 pts)
   - Reforçou importância dos encontros (5 pts)
   - Ofereceu apoio extra/disponibilidade (5 pts)

4. RISCO (10 pts):
   - Identificou sinais de desânimo, sumiço ou dificuldade crítica e agiu para motivar/reter o aluno.

5. FEEDBACK (10 pts):
   - Reconhecimento: Elogiou nominalmente uma conquista, tarefa feita ou a persistência do aluno.

--- MÉTRICAS DE COMPORTAMENTO DO ALUNO (OBRIGATÓRIO) ---
Avalie o aluno de 0 a 100:
- SENTIMENT_SCORE: Humor, satisfação e tom de voz (0 = Irritado/Desanimado, 100 = Empolgado/Satisfeito).
- ENGAGEMENT_SCORE: Participação ativa (0 = Monossilábico/Passivo, 100 = Proativo/Questionador).

--- FORMATO DE RESPOSTA (OBRIGATÓRIO - NÃO ALTERAR TAGS) ---
**Resumo da Análise:** [Resumo assertivo de 3-5 linhas sobre a dinâmica da reunião]

**Detalhamento por Critério:**
1. Progresso: [Nota]/50 - [Justificativa]
2. Qualidade: [Nota]/15 - [Justificativa]
3. Engajamento: [Nota]/15 - [Justificativa]
4. Risco: [Nota]/10 - [Justificativa]
5. Feedback: [Nota]/10 - [Justificativa]

SENTIMENT_SCORE: [Nota]
ENGAGEMENT_SCORE: [Nota]
FINAL_SCORE: [Soma dos itens 1 a 5]

--- DADOS DA REUNIÃO ---
Monitor: ${meeting.owner_name}
Transcrição: ${meeting.transcript.substring(0, 25000)}`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();
        const parsed = parseEvaluationText(responseText); // Aqui pegamos os 3 scores
        
        return { 
            score: parsed.finalScore, 
            sentimentScore: parsed.sentimentScore, 
            engagementScore: parsed.engagementScore, 
            evaluationText: responseText 
        };
    } catch (err) {
        console.error("Erro Gemini:", err.message);
        return { score: 0, sentimentScore: 0, engagementScore: 0, evaluationText: `FALHA IA: ${err.message}` };
    }
};

// 4. Busca da Planilha
async function fetchFromSheets() {
    const API_KEY = process.env.GOOGLE_API_KEY;
    const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
    const RANGE = 'Página1!A:L';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`;
    
    const response = await axios.get(url);
    const rows = response.data.values || [];
    
    // Ignora cabeçalho e mapeia
    return rows.slice(1).map((row, index) => {
        const rawStart = row[2];
        const rawEnd = row[3];
        return {
            session_id: row[0] || 'unknown',
            meeting_title: row[1] || 'Sem título',
            start_time: parseDate(rawStart),
            end_time: parseDate(rawEnd), 
            owner_name: row[4] ? row[4].trim() : 'Desconhecido',
            summary: row[5] || 'Sem resumo',
            topics: row[6] ? row[6].split(',').filter(t => t.trim() !== '') : [],
            sentiments: row[7] || 'Unknown',
            report_url: row[8] || '',
            chapters: row[9] ? row[9].split(';').map(c => {
                const parts = c.split(',').map(s => s.trim());
                return { title: parts[0] || '', description: parts[1] || '' };
            }) : [],
            transcript: row[10] || '',
            participants: (row[11] || '').split(',').reduce((acc, curr, i, arr) => {
                if (i % 2 === 0 && arr[i + 1]) acc.push({ name: curr.trim(), email: arr[i + 1].trim() });
                return acc;
            }, [])
        };
    });
}

// --- MIDDLEWARE AUTENTICAÇÃO ---
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

// --- ROTAS DE AUTENTICAÇÃO ---

app.post('/api/register', async (req, res) => {
    const { name, email, password, role = 'monitor' } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Faltam dados.' });
    if (!email.endsWith('@projetodesenvolve.com.br')) return res.status(400).json({ error: 'Domínio inválido.' });
    try {
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        const newUser = await pool.query(
            "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role",
            [name, email, password_hash, role]
        );
        res.status(201).json(newUser.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao registrar.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Faltam dados.' });
    try {
        const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userResult.rows.length === 0) return res.status(401).json({ error: 'Credenciais inválidas.' });
        const user = userResult.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ error: 'Credenciais inválidas.' });
        const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ token, user: payload });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no login.' });
    }
});

app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userResult.rows.length === 0) return res.status(200).json({ message: 'E-mail enviado se existir.' });
        
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000);
        await pool.query("UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE email = $3", [token, expires, email]);
        
        const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;
        console.log("LINK RECUPERACAO (DEV):", resetLink);

        const transporter = nodemailer.createTransport({ 
            service: process.env.EMAIL_SERVICE, 
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });
        
        try {
            await transporter.sendMail({ from: process.env.EMAIL_USER, to: email, subject: 'Redefinição de Senha', text: resetLink });
        } catch (e) { console.error("Erro email:", e); }

        res.status(200).json({ message: 'E-mail enviado.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao processar.' });
    }
});

app.post('/api/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;
    try {
        const userResult = await pool.query("SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > NOW()", [token]);
        if (userResult.rows.length === 0) return res.status(400).json({ error: 'Token expirado.' });
        
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        await pool.query("UPDATE users SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2", [hash, userResult.rows[0].id]);
        
        res.status(200).json({ message: 'Sucesso!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro reset.' });
    }
});

// --- ROTAS DA APLICAÇÃO ---

app.get('/api/meetings', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const { role, name } = req.user;
        let query = 'SELECT * FROM meetings';
        const params = [];
        let whereClauses = [];

        if (role !== 'admin') {
            params.push(name);
            whereClauses.push(`owner_name = $${params.length}`);
        }
        if (startDate && endDate) {
            params.push(startDate, endDate);
            whereClauses.push(`start_time >= $${params.length - 1} AND start_time <= $${params.length}`);
        }
        if (whereClauses.length > 0) query += ' WHERE ' + whereClauses.join(' AND ');
        query += ' ORDER BY start_time DESC';
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro meetings.' });
    }
});

// ROTA DE UPDATE (CORRIGIDA)
app.post('/api/update', authenticateToken, async (req, res) => {
    try {
        // 1. Busca dados do Sheets
        const sheetsMeetings = await fetchFromSheets();
        
        // 2. Verifica quais já existem no banco para evitar reprocessamento desnecessário
        // (Isso é útil mesmo se você limpar o banco, pois no início ele retorna lista vazia)
        const existingIds = (await pool.query('SELECT session_id FROM meetings')).rows.map(r => r.session_id);
        const newMeetings = sheetsMeetings.filter(m => !existingIds.includes(m.session_id));
        
        if (newMeetings.length === 0) return res.json({ message: 'Nenhuma nova reunião para processar.' });

        console.log(`Iniciando avaliação de ${newMeetings.length} reuniões...`);

       // 3. Avalia com Gemini (Processamento Paralelo)
        const evaluated = await Promise.all(newMeetings.map(async (m) => {
            const result = await evaluateMeetingWithGemini(m);
            return { 
                ...m, 
                score: result.score, 
                evaluation_text: result.evaluationText,
                sentiment_score: result.sentimentScore,
                engagement_score: result.engagementScore
            };
        }));

        // 4. Inserção no Banco
        for (const m of evaluated) {
            let duration = (m.start_time && m.end_time) ? Math.floor((m.end_time - m.start_time) / 60000) : 0;
            if (isNaN(duration)) duration = 0;

            await pool.query(`
                INSERT INTO meetings (
                    session_id, meeting_title, owner_name, summary, topics, sentiments,
                    chapters, transcript, participants, start_time, end_time, duration_minutes,
                    report_url, score, evaluation_text, sentiment_score, engagement_score
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                ON CONFLICT (session_id) DO UPDATE SET
                    score = EXCLUDED.score,
                    evaluation_text = EXCLUDED.evaluation_text,
                    sentiment_score = EXCLUDED.sentiment_score,
                    engagement_score = EXCLUDED.engagement_score,
                    duration_minutes = EXCLUDED.duration_minutes,
                    summary = EXCLUDED.summary
            `, [
                m.session_id, m.meeting_title, m.owner_name, m.summary,
                JSON.stringify(m.topics), m.sentiments,
                JSON.stringify(m.chapters), m.transcript,
                JSON.stringify(m.participants),
                m.start_time, m.end_time, duration,
                m.report_url, m.score, m.evaluation_text,
                m.sentiment_score, m.engagement_score
            ]);
        
        }
        res.json({ message: `Processamento concluído. Adicionadas: ${evaluated.length}` });
    } catch (err) {
        console.error("Erro geral na rota update:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- INICIALIZAÇÃO ---
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
}

module.exports = app;