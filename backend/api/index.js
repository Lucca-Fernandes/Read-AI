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
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// --- FUNÇÕES AUXILIARES ---

// Lógica de parsing unificada para SEMPRE somar os critérios, garantindo a nota correta.
const parseEvaluationText = (text) => {
  if (!text || typeof text !== 'string') {
    return { sections: [], summary: 'Texto de avaliação inválido ou ausente.', finalScore: -1 };
  }
  
  try {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const sections = [];
    let currentSection = null;
    let summary = '';
    
    const summaryRegex = /\*\*Resumo da Análise:\*\*([\s\S]*)/;
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
    });

    if (currentSection) sections.push(currentSection);

    if (sections.length > 0) {
        const finalScore = sections.reduce((total, section) => {
          return total + section.criteria.reduce((sectionSum, crit) => sectionSum + crit.awardedPoints, 0);
        }, 0);
        return { sections, summary, finalScore };
    }
    
    // Se não encontrou nenhuma seção de critérios, marca como falha.
    return { sections: [], summary: 'Falha ao processar a avaliação (formato irreconhecível).', finalScore: -1, rawText: text };

  } catch (error) {
    console.error("Falha catastrófica ao parsear o texto de avaliação:", error);
    return { sections: [], summary: 'Falha ao processar a avaliação.', finalScore: -1, rawText: text };
  }
};

const evaluateMeetingWithGemini = async (meeting) => {
    const nonConductedSummary = "No summary available due to limited meeting data.";
    if ((meeting.summary || '').trim() === nonConductedSummary) {
        return { score: 0, evaluationText: 'Não realizada (resumo indicou dados de reunião limitados).' };
    }
    try {
        const prompt = `Analise a transcrição da reunião de monitoria. Sua análise e pontuação devem se basear estritamente nos diálogos e eventos descritos na transcrição.

**TAREFA:**

1.  Para CADA UM dos subcritérios listados abaixo, atribua uma pontuação.
2.  A pontuação de cada subcritério deve ser o valor máximo indicado se o critério foi totalmente cumprido, ou 0 se não foi cumprido ou se a informação não está na transcrição.
3.  Liste la pontuação de cada subcritério de forma explícita.
4.  Some todas as pontuações para calcular o Score Final.
5.  Apresente um resumo da sua análise.
6.  No final de TUDO, adicione a linha no formato exato: 'FINAL_SCORE: <seu score final aqui>'.

**CRITÉRIOS DE AVALIAÇÃO:**

**1. Progresso do Aluno (Peso Total: 50 pontos)**
   - Perguntou sobre a semana do aluno? (5 pontos):
   - Verificou a conclusão da meta anterior? (10 pontos):
   - Estipou uma nova meta para o aluno? (10 pontos):
   - Perguntou sobre o conteúdo estudado? (20 pontos):
   - Perguntou sobre os exercícios? (5 pontos):

**2. Qualidade do Atendimento (Peso Total: 15 pontos)**
   - Esclareceu todas as dúvidas corretamente? (10 pontos):
   - Demonstrou boa condução e organização? (5 pontos):

**3. Engajamento e Motivação (Peso Total: 15 pontos)**
   - Incentivou o aluno a se manter no curso? (5 pontos):
   - Reforçou a importância das metas e encontros? (5 pontos):
   - Ofereceu apoio extra (dicas, recursos)? (5 pontos):

**4. Registro de Sinais de Risco (Peso Total: 10 pontos)**
   - Conduziu corretamente casos de desmotivação ou risco? (10 pontos):

**5. Feedback ao Aluno (Peso Total: 10 pontos)**
   - Reconheceu conquistas e avanços do aluno? (5 pontos):
   - Feedback sobre a meta (5 pontos): A regra para este critério é: Se a meta anterior do aluno foi atingida, a nota é 5. Se a meta anterior NÃO foi atingida, a nota só será 5 se o monitor ofereceu um feedback construtivo sobre isso. Caso contrário, a nota é 0.

--- DADOS DA REUNIÃO ---

Resumo (Contexto Secundário): ${meeting.summary}
TRANSCRIÇÃO COMPLETA (Fonte Principal): ${meeting.transcript}`;
        
        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();
        const { finalScore } = parseEvaluationText(responseText);
        return { score: finalScore, evaluationText: responseText };
    } catch (err) {
        console.error(`Erro ao avaliar meeting ${meeting.session_id}:`, err);
        return { score: -1, evaluationText: `FALHA: Erro de API. ${err.message}` };
    }
};

async function fetchFromSheets() {
    const API_KEY = process.env.GOOGLE_API_KEY;
    const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
    const RANGE = 'Página1!A:L';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`;
    
    const response = await axios.get(url);
    const rows = response.data.values || [];
    
    return rows.slice(1).map((row) => ({
        session_id: row[0] || 'unknown',
        meeting_title: row[1] || 'Sem título',
        start_time: row[2] || null,
        end_time: row[3] || null,
        owner_name: row[4] ? row[4].trim() : 'Desconhecido',
        summary: row[5] || 'Sem resumo',
        topics: row[6] ? row[6].split(',').filter(t => t && t.toLowerCase() !== 'nenhum' && t.trim() !== '') : [],
        sentiments: row[7] || 'Unknown',
        report_url: row[8] || '',
        chapters: row[9] ? row[9].split(';').filter(c => c).map(c => {
            const parts = c.split(',').map(s => s.trim());
            return { title: parts[0] || '', description: parts[1] || '' };
        }) : [],
        transcript: row[10] || '',
        participants: (row[11] || '').split(',').reduce((acc, curr, i, arr) => {
            if (i % 2 === 0 && arr[i + 1]) {
                acc.push({ name: curr.trim(), email: arr[i + 1].trim() });
            }
            return acc;
        }, [])
    }));
}

// --- ROTAS DE AUTENTICAÇÃO ---

app.post('/api/register', async (req, res) => {
    const { name, email, password, role = 'monitor' } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
    }
    if (!email.endsWith('@projetodesenvolve.com.br')) {
        return res.status(400).json({ error: 'Apenas emails com o domínio @projetodesenvolve.com.br são permitidos.' });
    }
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
        res.status(500).json({ error: 'Email já cadastrado ou erro no servidor.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }
    try {
        const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }
        const user = userResult.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }
        const payload = { id: user.id, name: user.name, email: user.email, role: user.role, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 8) }; // Token expira em 8 horas
        const token = jwt.sign(payload, process.env.JWT_SECRET);
        res.json({ token, user: payload });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// --- ROTAS DE REDEFINIÇÃO DE SENHA ---

app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userResult.rows.length === 0) {
            return res.status(200).json({ message: 'Se um usuário com este email existir, um link de redefinição foi enviado.' });
        }
        const user = userResult.rows[0];
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hora
        await pool.query(
            "UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE email = $3",
            [token, expires, email]
        );
        const transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Redefinição de Senha - Painel de Análises',
            text: `Você está recebendo este email porque solicitou a redefinição da sua senha.\n\n` +
                  `Por favor, clique no link abaixo ou cole no seu navegador para completar o processo:\n\n` +
                  `${resetLink}\n\n` +
                  `Se você não solicitou isso, por favor, ignore este email e sua senha permanecerá inalterada.\n`
        };
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Se um usuário com este email existir, um link de redefinição foi enviado.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao processar a solicitação.' });
    }
});

app.post('/api/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;
    try {
        const userResult = await pool.query(
            "SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > NOW()",
            [token]
        );
        if (userResult.rows.length === 0) {
            return res.status(400).json({ error: 'Token de redefinição de senha inválido ou expirado.' });
        }
        const user = userResult.rows[0];
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        await pool.query(
            "UPDATE users SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2",
            [password_hash, user.id]
        );
        res.status(200).json({ message: 'Senha redefinida com sucesso!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao redefinir a senha.' });
    }
});

// --- MIDDLEWARE DE AUTENTICAÇÃO ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Erro na verificação do token:', err);
            return res.sendStatus(403); // Forbidden
        }
        req.user = user;
        next();
    });
};

// --- ROTAS DA APLICAÇÃO ---

app.get('/api/meetings', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const { role, name } = req.user;
        let query = 'SELECT * FROM meetings';
        const queryParams = [];
        let whereClauses = [];
        if (role !== 'admin') {
            queryParams.push(name);
            whereClauses.push(`owner_name = $${queryParams.length}`);
        }
        if (startDate && endDate) {
            const adjustedEndDate = new Date(endDate);
            adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);
            queryParams.push(startDate, adjustedEndDate.toISOString().split('T')[0]);
            whereClauses.push(`start_time >= $${queryParams.length - 1} AND start_time < $${queryParams.length}`);
        }
        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        }
        query += ' ORDER BY start_time DESC';
        const result = await pool.query(query, queryParams);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.post('/api/update', authenticateToken, async (req, res) => {
    try {
        const sheetsMeetings = await fetchFromSheets();
        const existingIds = (await pool.query('SELECT session_id FROM meetings')).rows.map(r => r.session_id);
        const newMeetings = sheetsMeetings.filter(m => !existingIds.includes(m.session_id));
        if (newMeetings.length === 0) {
            return res.json({ message: 'Nenhuma nova reunião encontrada para adicionar.' });
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

// Exporta o app para a Vercel
module.exports = app;