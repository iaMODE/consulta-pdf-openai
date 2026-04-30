let pdfText = "";

// ELEMENTOS
const apiKeyInput = document.getElementById("apiKey");
const saveKeyBtn = document.getElementById("saveKeyBtn");
const deleteKeyBtn = document.getElementById("deleteKeyBtn");
const resetBtn = document.getElementById("resetBtn");
const keyStatus = document.getElementById("keyStatus");

const pdfFile = document.getElementById("pdfFile");
const pdfTextBox = document.getElementById("pdfText");

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
  pdfTextBox.textContent = "El texto de tu documento aparecerá aquí.";
  questionInput.value = "";
  answerBox.textContent = "La respuesta aparecerá aquí.";
});

// -----------------------------
// CARGA PDF (FRONTEND CON PDF.JS)
// -----------------------------
pdfFile.addEventListener("change", async () => {
  const file = pdfFile.files[0];
  if (!file) return;

  if (file.type !== "application/pdf") {
    pdfTextBox.textContent = "Solo se permiten PDFs.";
    return;
  }

  pdfTextBox.textContent = "Procesando PDF (rápido)...";
  pdfText = "";

  try {
    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      const pageText = content.items.map(item => item.str).join(" ");

      fullText += `\n\n--- PÁGINA ${i} ---\n` + pageText;
    }

    pdfText = fullText.trim();

    if (!pdfText) {
      pdfTextBox.textContent = "No se pudo extraer texto (PDF escaneado).";
      return;
    }

    pdfTextBox.textContent = pdfText;

  } catch (err) {
    pdfTextBox.textContent = "Error procesando PDF.";
  }
});

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

  answerBox.textContent = "Consultando...";

  try {
    const response = await fetch("/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        pdf_text: pdfText,
        question: question,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Error IA");
    }

    answerBox.textContent = data.answer;

  } catch (err) {
    answerBox.textContent = "Error al consultar.";
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