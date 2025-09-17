require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors({ origin: 'http://localhost:5173' }));

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const parseEvaluationText = (text) => {
  if (!text || typeof text !== 'string') {
    return { sections: [], summary: 'Texto de avaliação inválido ou ausente.', finalScore: 0 };
  }
  try {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const sections = [];
    let currentSection = null;
    let summary = '';
    const summaryRegex = /\*\*Resumo da Análise:\*\*([\s\S]*?)(?=FINAL_SCORE:|$)/;
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
      const reducerRegex = /- (Uso de linguagem informal.*?)\s*\(-(\d+) pontos se sim, 0 se não\):\s*(-?\d+)/;
      const reducerMatch = line.match(reducerRegex);
      if (reducerMatch) {
        const reducerSection = {
          title: "Redutor de Linguagem",
          maxPoints: -parseInt(reducerMatch[2], 10),
          isReducer: true,
          criteria: [{
            text: reducerMatch[1].trim(),
            maxPoints: -parseInt(reducerMatch[2], 10),
            awardedPoints: parseInt(reducerMatch[3], 10),
            justification: ""
          }]
        };
        sections.push(reducerSection);
      }
    });
    if (currentSection) sections.push(currentSection);
    const finalScore = sections.reduce((total, section) => {
      return total + section.criteria.reduce((sectionSum, crit) => sectionSum + crit.awardedPoints, 0);
    }, 0);
    return { sections, summary, finalScore };
  } catch (error) {
    console.error("Falha ao parsear o texto de avaliação:", error);
    const fallbackScores = {
        week: text.match(/Perguntou sobre a semana do aluno\?\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
        prevGoal: text.match(/Verificou a conclusão da meta anterior\?\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
        newGoal: text.match(/Estipulou uma nova meta para o aluno\?\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
        content: text.match(/Perguntou sobre o conteúdo estudado\?\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
        exercises: text.match(/Perguntou sobre os exercícios\?\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
        doubts: text.match(/Esclareceu todas as dúvidas corretamente\?\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
        organization: text.match(/Demonstrou boa condução e organização\?\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
        motivation: text.match(/Incentivou o aluno a se manter no curso\?\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
        goalsImportance: text.match(/Reforçou a importância das metas e encontros\?\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
        extraSupport: text.match(/Ofereceu apoio extra\s*\(dicas, recursos\)\?\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
        risk: text.match(/Conduziu corretamente casos de desmotivação ou risco\?\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
        achievements: text.match(/Reconheceu conquistas e avanços do aluno\?\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
        goalFeedback: text.match(/Feedback sobre a meta\s*[:\-]?\s*(\d+)/i)?.[1] || 0,
        languageReducer: text.match(/Uso de linguagem informal ou inadequada\?\s*[:\-]?\s*(-?\d+)/i)?.[1] || 0,
    };
    const fallbackFinalScore = Object.values(fallbackScores).reduce((sum, score) => sum + parseInt(score || 0, 10), 0);
    return { sections: [], summary: 'Falha ao processar a avaliação. Usando soma calculada como fallback.', finalScore: fallbackFinalScore, rawText: text };
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

1. Para CADA UM dos subcritérios listados abaixo, atribua uma pontuação.
2. A pontuação de cada subcritério deve ser o valor máximo indicado se o critério foi totalmente cumprido, ou 0 se não foi cumprido ou se a informação não está na transcrição.
3. Liste a pontuação de cada subcritério de forma explícita.
4. Some todas as pontuações para calcular o Score Final.
5. Apresente um resumo da sua análise.
6. No final de TUDO, adicione a linha no formato exato: 'FINAL_SCORE: <seu score final aqui>'.

**CRITÉRIOS DE AVALIAÇÃO:**

**1. Progresso do Aluno (Peso Total: 50 pontos)**
   - Perguntou sobre a semana do aluno? (5 pontos):
   - Verificou a conclusão da meta anterior? (10 pontos):
   - Estipulou uma nova meta para o aluno? (10 pontos):
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
    
    return rows.slice(1).map((row, index) => ({
        id: index + 1,
        session_id: row[0] || 'unknown',
        meeting_title: row[1] || 'Sem título',
        start_time: row[2] || '',
        end_time: row[3] || '',
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

app.get('/api/meetings', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        let query = 'SELECT * FROM meetings';
        const queryParams = [];

        if (startDate && endDate) {
            const adjustedEndDate = new Date(endDate);
            adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);

            query += ' WHERE start_time >= $1 AND start_time < $2';
            queryParams.push(startDate, adjustedEndDate.toISOString().split('T')[0]);
        }

        query += ' ORDER BY start_time DESC';

        const result = await pool.query(query, queryParams);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});


app.post('/api/update', async (req, res) => {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));