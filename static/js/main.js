let pdfText = "";
let pdfPages = [];

// ELEMENTOS
const apiKeyInput = document.getElementById("apiKey");
const saveKeyBtn = document.getElementById("saveKeyBtn");
const deleteKeyBtn = document.getElementById("deleteKeyBtn");
const resetBtn = document.getElementById("resetBtn");
const keyStatus = document.getElementById("keyStatus");

const pdfFile = document.getElementById("pdfFile");
const pdfTextBox = document.getElementById("pdfText");
const uploadBox = document.querySelector(".upload-box");

const questionInput = document.getElementById("question");
const askBtn = document.getElementById("askBtn");
const answerBox = document.getElementById("answer");

const copyBtn = document.getElementById("copyAnswerBtn");
const saveBtn = document.getElementById("saveAnswerBtn");

// -----------------------------
// API KEY
// -----------------------------
const savedKey = localStorage.getItem("openai_api_key");
if (savedKey) {
  apiKeyInput.value = savedKey;
  keyStatus.textContent = "API Key cargada.";
}

saveKeyBtn.addEventListener("click", () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    keyStatus.textContent = "Debes pegar una API Key.";
    return;
  }
  localStorage.setItem("openai_api_key", key);
  keyStatus.textContent = "API Key guardada.";
});

deleteKeyBtn.addEventListener("click", () => {
  localStorage.removeItem("openai_api_key");
  apiKeyInput.value = "";
  keyStatus.textContent = "API Key eliminada.";
});

// -----------------------------
// REINICIAR
// -----------------------------
resetBtn.addEventListener("click", () => {
  pdfText = "";
  pdfPages = [];
  pdfFile.value = "";
  pdfTextBox.textContent = "El texto de tu documento aparecerá aquí.";
  questionInput.value = "";
  answerBox.textContent = "La respuesta aparecerá aquí.";
});

// -----------------------------
// NORMALIZAR TEXTO
// -----------------------------
function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function spacedNumberPattern(number) {
  return number
    .split("")
    .map(char => escapeRegExp(char))
    .join("\\s*");
}

// -----------------------------
// DETECTAR ARTÍCULOS EN LA PREGUNTA
// -----------------------------
function extractArticleNumbers(question) {
  const normalized = normalizeText(question);
  const articleNumbers = new Set();

  const patterns = [
    /articulo\s+(\d+[a-z]?)/gi,
    /articulos\s+(\d+[a-z]?)/gi,
    /art\.?\s*(\d+[a-z]?)/gi,
    /arts\.?\s*(\d+[a-z]?)/gi,
    /\bart\s+(\d+[a-z]?)/gi,
    /\bnum\.?\s*(\d+[a-z]?)/gi,
    /\bnumero\s+(\d+[a-z]?)/gi
  ];

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(normalized)) !== null) {
      articleNumbers.add(match[1]);
    }
  });

  return Array.from(articleNumbers);
}

// -----------------------------
// PALABRAS CLAVE
// -----------------------------
function getKeywords(question) {
  const stopwords = [
    "que", "qué", "cual", "cuál", "cuales", "cuáles", "como", "cómo",
    "donde", "dónde", "cuando", "cuándo", "quien", "quién", "quienes",
    "de", "del", "la", "las", "el", "los", "un", "una", "unos", "unas",
    "y", "o", "u", "en", "por", "para", "con", "sin", "sobre", "segun",
    "según", "al", "a", "me", "se", "es", "son", "dice", "indica",
    "documento", "pdf", "articulo", "artículo", "articulos", "artículos",
    "pagina", "página"
  ];

  return normalizeText(question)
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length >= 4 && !stopwords.includes(word));
}

// -----------------------------
// BUSCAR PÁGINAS POR ARTÍCULO
// -----------------------------
function getPagesByArticles(articleNumbers) {
  if (!articleNumbers.length) return [];

  const matchedPages = [];

  pdfPages.forEach(page => {
    const normalized = normalizeText(page.text);
    let score = 0;

    articleNumbers.forEach(number => {
      const safeNumber = escapeRegExp(number);
      const spacedNumber = spacedNumberPattern(number);

      const articlePatterns = [
        new RegExp(`\\barticulo\\s+${safeNumber}\\b`, "i"),
        new RegExp(`\\barticulos\\s+${safeNumber}\\b`, "i"),
        new RegExp(`\\bart\\.?\\s*${safeNumber}\\b`, "i"),
        new RegExp(`\\barts\\.?\\s*${safeNumber}\\b`, "i"),
        new RegExp(`\\bart\\.?\\s*${spacedNumber}\\b`, "i"),
        new RegExp(`\\barticulo\\s+${spacedNumber}\\b`, "i"),
        new RegExp(`\\b${safeNumber}\\s*\\.\\s*-`, "i"),
        new RegExp(`\\b${safeNumber}\\s*-`, "i"),
        new RegExp(`\\b${safeNumber}\\s*\\.`, "i")
      ];

      articlePatterns.forEach(pattern => {
        if (pattern.test(normalized)) {
          score += 30;
        }
      });

      if (normalized.includes(number)) {
        score += 2;
      }
    });

    if (score > 0) {
      matchedPages.push({
        pageNumber: page.pageNumber,
        text: page.text,
        score
      });
    }
  });

  return matchedPages.sort((a, b) => b.score - a.score);
}

// -----------------------------
// BUSCAR PÁGINAS RELEVANTES
// -----------------------------
function getRelevantPages(question) {
  if (!pdfPages.length) return pdfText;

  const articleNumbers = extractArticleNumbers(question);
  const articleMatches = getPagesByArticles(articleNumbers);

  const selectedPageNumbers = new Set();

  // PRIORIDAD 1: ARTÍCULOS MENCIONADOS
  if (articleMatches.length) {
    articleMatches.slice(0, 3).forEach(page => {
      selectedPageNumbers.add(page.pageNumber - 1);
      selectedPageNumbers.add(page.pageNumber);
      selectedPageNumbers.add(page.pageNumber + 1);
      selectedPageNumbers.add(page.pageNumber + 2);
    });

    return pdfPages
      .filter(page => selectedPageNumbers.has(page.pageNumber))
      .map(page => `\n\n--- PÁGINA PDF ${page.pageNumber} ---\n${page.text}`)
      .join("");
  }

  // PRIORIDAD 2: PALABRAS CLAVE
  const keywords = getKeywords(question);

  if (!keywords.length) {
    return pdfPages
      .slice(0, 10)
      .map(page => `\n\n--- PÁGINA PDF ${page.pageNumber} ---\n${page.text}`)
      .join("");
  }

  const scoredPages = pdfPages.map(page => {
    const normalized = normalizeText(page.text);
    let score = 0;

    keywords.forEach(keyword => {
      const safeKeyword = escapeRegExp(keyword);
      const matches = normalized.match(new RegExp(`\\b${safeKeyword}\\b`, "g"));
      if (matches) score += matches.length;

      if (normalized.includes(keyword)) score += 1;
    });

    return {
      pageNumber: page.pageNumber,
      text: page.text,
      score
    };
  });

  const topPages = scoredPages
    .filter(page => page.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (!topPages.length) {
    return pdfPages
      .slice(0, 10)
      .map(page => `\n\n--- PÁGINA PDF ${page.pageNumber} ---\n${page.text}`)
      .join("");
  }

  topPages.forEach(page => {
    selectedPageNumbers.add(page.pageNumber - 1);
    selectedPageNumbers.add(page.pageNumber);
    selectedPageNumbers.add(page.pageNumber + 1);
  });

  return pdfPages
    .filter(page => selectedPageNumbers.has(page.pageNumber))
    .map(page => `\n\n--- PÁGINA PDF ${page.pageNumber} ---\n${page.text}`)
    .join("");
}

// -----------------------------
// PROCESAR PDF
// -----------------------------
async function processPdfFile(file) {
  if (!file) return;

  if (file.type !== "application/pdf") {
    pdfTextBox.textContent = "Solo se permiten PDFs.";
    return;
  }

  pdfTextBox.textContent = "Procesando PDF...";
  pdfText = "";
  pdfPages = [];

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      const pageText = content.items.map(item => item.str).join(" ");

      pdfPages.push({
        pageNumber: i,
        text: pageText
      });

      fullText += `\n\n--- PÁGINA PDF ${i} ---\n${pageText}`;
    }

    pdfText = fullText.trim();

    if (!pdfText) {
      pdfTextBox.textContent = "No se pudo extraer texto (PDF escaneado).";
      return;
    }

    pdfTextBox.textContent = pdfText;

  } catch (err) {
    pdfTextBox.textContent = "Error procesando PDF: " + err.message;
    console.error(err);
  }
}

// -----------------------------
// CARGA PDF CON PDF.JS
// -----------------------------
pdfFile.addEventListener("change", async () => {
  const file = pdfFile.files[0];
  await processPdfFile(file);
});

// -----------------------------
// ARRASTRAR Y SOLTAR PDF
// -----------------------------
if (uploadBox) {
  ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
    uploadBox.addEventListener(eventName, event => {
      event.preventDefault();
      event.stopPropagation();
    });
  });

  uploadBox.addEventListener("dragover", () => {
    uploadBox.classList.add("drag-over");
  });

  uploadBox.addEventListener("dragleave", () => {
    uploadBox.classList.remove("drag-over");
  });

  uploadBox.addEventListener("drop", async event => {
    uploadBox.classList.remove("drag-over");

    const file = event.dataTransfer.files[0];

    if (!file) return;

    if (file.type !== "application/pdf") {
      pdfTextBox.textContent = "Solo se permiten PDFs.";
      return;
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    pdfFile.files = dataTransfer.files;

    await processPdfFile(file);
  });
}

// -----------------------------
// PREGUNTAR
// -----------------------------
askBtn.addEventListener("click", async () => {
  const apiKey = apiKeyInput.value.trim();
  const question = questionInput.value.trim();

  if (!apiKey) {
    answerBox.textContent = "Debes introducir tu API Key.";
    return;
  }

  if (!pdfText) {
    answerBox.textContent = "Primero carga un PDF.";
    return;
  }

  if (!question) {
    answerBox.textContent = "Escribe una pregunta.";
    return;
  }

  const articleNumbers = extractArticleNumbers(question);
  const relevantText = getRelevantPages(question);

  answerBox.textContent = "Consultando páginas y artículos relevantes...";

  try {
    const response = await fetch("/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        pdf_text: relevantText,
        question: question,
        detected_articles: articleNumbers
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Error IA");
    }

    answerBox.textContent = data.answer;

  } catch (err) {
    answerBox.textContent = "Error al consultar: " + err.message;
    console.error(err);
  }
});

// -----------------------------
// COPIAR
// -----------------------------
copyBtn.addEventListener("click", async () => {
  const text = answerBox.textContent;
  if (!text) return;

  await navigator.clipboard.writeText(text);
  copyBtn.textContent = "✓";
  setTimeout(() => (copyBtn.textContent = "⧉"), 1000);
});

// -----------------------------
// DESCARGAR
// -----------------------------
saveBtn.addEventListener("click", () => {
  const text = answerBox.textContent;
  if (!text) return;

  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "respuesta.txt";
  a.click();

  URL.revokeObjectURL(url);
});