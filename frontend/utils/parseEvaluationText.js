// src/utils/parseEvaluationText.js

export const parseEvaluationText = (text, dbScore = 0) => {
  if (!text || typeof text !== 'string') {
    return { sections: [], summary: '', finalScore: dbScore, rawText: text };
  }

  const sections = [];
  let currentSection = null;
  let summary = '';
  let finalScoreFromText = null;

  const lines = text.split('\n');

  // 1. Resumo (robusto para variações)
  const summaryMatch = text.match(/\*\*Resumo da Análise:\*\*([\s\S]*?)(?=\*\*|Critérios|FINAL_SCORE|\d+\.|$)/i);
  if (summaryMatch) summary = summaryMatch[1].trim();

  // 2. Nota final do texto (fallback se parser falhar)
  const scoreMatch = text.match(/FINAL_SCORE[\s:]*(\d+)/i);
  if (scoreMatch) finalScoreFromText = parseInt(scoreMatch[1], 10);

  for (let rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    // HEADER DE SEÇÃO – captura todos os padrões reais do Gemini
    // Ex: "1. **Progresso (22/50 pts):**" ou "**Qualidade (15 pts): **" ou "Progresso (25/50 pts):"
    const headerRegex = /^(?:\d+\.\s*)?\*?\*?\s*([A-Za-zÀ-ÿ\s]+?)\s*\*?\*?\s*\(\s*(\d+)\s*(?:\/\s*(\d+)\s*)?(?:pts?|pontos)?\s*\)\s*:?\*?\*?\s*$/i;
    const headerMatch = line.match(headerRegex);

    if (headerMatch) {
      if (currentSection) sections.push(currentSection);

      const title = headerMatch[1].trim();
      const num1 = parseInt(headerMatch[2], 10);
      const num2 = headerMatch[3] ? parseInt(headerMatch[3], 10) : num1;

      currentSection = {
        title,
        maxPoints: Math.max(num1, num2),
        criteria: []
      };
      continue;
    }

    // CRITÉRIO – captura com espaços variáveis, **, (x/y pts), : ou sem
    // Ex: "*   **Semana do aluno (0/5):** ..." ou "* **Meta anterior (0/10):** ..."
    const criteriaRegex = /^[\*\-]\s*\*?\*?\s*([^\(]+?)\s*\*?\*?\s*\(\s*(\d+)\s*\/\s*(\d+)\s*\)\s*(?:pts?|pontos)?\s*:?\s*(.+)?$/i;
    const critMatch = line.match(criteriaRegex);

    if (critMatch && currentSection) {
      currentSection.criteria.push({
        text: critMatch[1].trim(),
        awardedPoints: parseInt(critMatch[2], 10),
        maxPoints: parseInt(critMatch[3], 10),
        justification: (critMatch[4] || '').trim()
      });
      continue;
    }
  }

  if (currentSection) sections.push(currentSection);

  // Cálculo da nota baseada em critérios
  let calculatedScore = 0;
  if (sections.length > 0) {
    calculatedScore = sections.reduce((total, sec) => {
      return total + sec.criteria.reduce((sum, c) => sum + c.awardedPoints, 0);
    }, 0);
  }

  const finalScore = calculatedScore > 0 ? calculatedScore : (finalScoreFromText || dbScore);

  return {
    sections,
    summary: summary || 'Sem resumo disponível.',
    finalScore,
    rawText: sections.length === 0 ? text : null
  };
};