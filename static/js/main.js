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

// -----------------------------
// DETECTAR MODO LISTA (NUEVO)
// -----------------------------
function isListQuery(question) {
  const q = normalizeText(question);
  return (
    q.includes("lista") ||
    q.includes("todos los articulos") ||
    q.includes("donde se menciona") ||
    q.includes("donde aparezca") ||
    q.includes("donde se habla") ||
    q.includes("articulos sobre")
  );
}

// -----------------------------
// DETECTAR ARTÍCULOS
// -----------------------------
function extractArticleNumbers(question) {
  const normalized = normalizeText(question);
  const articleNumbers = new Set();

  const patterns = [
    /articulo\s+(\d+[a-z]?)/gi,
    /articulos\s+(\d+[a-z]?)/gi,
    /art\.?\s*(\d+[a-z]?)/gi,
    /arts\.?\s*(\d+[a-z]?)/gi
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
// KEYWORDS
// -----------------------------
function getKeywords(question) {
  return normalizeText(question)
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 4);
}

// -----------------------------
// BUSCAR PÁGINAS
// -----------------------------
function getRelevantPages(question) {
  if (!pdfPages.length) return pdfText;

  const listMode = isListQuery(question);
  const keywords = getKeywords(question);

  let selectedPages = [];

  pdfPages.forEach(page => {
    const text = normalizeText(page.text);
    let score = 0;

    keywords.forEach(k => {
      if (text.includes(k)) score++;
    });

    if (score > 0) {
      selectedPages.push({
        pageNumber: page.pageNumber,
        text: page.text,
        score
      });
    }
  });

  selectedPages = selectedPages.sort((a, b) => b.score - a.score);

  // ⚠️ DIFERENCIA CLAVE
  const limit = listMode ? 15 : 6;

  const pages = selectedPages.slice(0, limit);

  const set = new Set();

  pages.forEach(p => {
    set.add(p.pageNumber);
    if (!listMode) {
      set.add(p.pageNumber - 1);
      set.add(p.pageNumber + 1);
    }
  });

  return pdfPages
    .filter(p => set.has(p.pageNumber))
    .map(p => `\n\n--- PÁGINA PDF ${p.pageNumber} ---\n${p.text}`)
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

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    const text = content.items.map(i => i.str).join(" ");

    pdfPages.push({
      pageNumber: i,
      text
    });
  }

  pdfTextBox.textContent = "PDF cargado correctamente.";
}

// -----------------------------
// ENTER PARA ENVIAR (NUEVO)
// -----------------------------
questionInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    askBtn.click();
  }
});

// -----------------------------
// PREGUNTAR
// -----------------------------
askBtn.addEventListener("click", async () => {
  const apiKey = apiKeyInput.value.trim();
  const question = questionInput.value.trim();

  if (!apiKey || !pdfPages.length || !question) return;

  const relevantText = getRelevantPages(question);

  answerBox.textContent = "Consultando...";

  const response = await fetch("/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      pdf_text: relevantText,
      question
    })
  });

  const data = await response.json();
  answerBox.textContent = data.answer;
});

// -----------------------------
// COPIAR
// -----------------------------
copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(answerBox.textContent);
});

// -----------------------------
// DESCARGAR
// -----------------------------
saveBtn.addEventListener("click", () => {
  const blob = new Blob([answerBox.textContent], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "respuesta.txt";
  a.click();

  URL.revokeObjectURL(url);
});