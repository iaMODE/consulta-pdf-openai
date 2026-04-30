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
// API KEY (LOCAL STORAGE)
// -----------------------------
const savedKey = localStorage.getItem("openai_api_key");
if (savedKey) {
  apiKeyInput.value = savedKey;
  keyStatus.textContent = "API Key cargada correctamente.";
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
// REINICIAR APP
// -----------------------------
resetBtn.addEventListener("click", () => {
  pdfText = "";
  pdfTextBox.textContent = "El texto de tu documento aparecerá aquí.";
  questionInput.value = "";
  answerBox.textContent = "La respuesta aparecerá aquí.";
});

// -----------------------------
// SUBIR PDF
// -----------------------------
pdfFile.addEventListener("change", async () => {
  const file = pdfFile.files[0];

  if (!file) return;

  if (file.type !== "application/pdf") {
    pdfTextBox.textContent = "Solo se permiten archivos PDF.";
    return;
  }

  pdfTextBox.textContent = "Procesando PDF...";
  answerBox.textContent = "La respuesta aparecerá aquí.";
  pdfText = "";

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("/upload_pdf", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Error procesando PDF");
    }

    pdfText = data.text || "";

    if (!pdfText.trim()) {
      pdfTextBox.textContent =
        "No se pudo extraer texto del PDF (puede ser escaneado).";
      return;
    }

    pdfTextBox.textContent = pdfText;
  } catch (error) {
    pdfTextBox.textContent = "Error: " + error.message;
  }
});

// -----------------------------
// HACER PREGUNTA
// -----------------------------
askBtn.addEventListener("click", async () => {
  const apiKey = apiKeyInput.value.trim();
  const question = questionInput.value.trim();

  if (!apiKey) {
    answerBox.textContent = "Debes introducir tu API Key.";
    return;
  }

  if (!pdfText.trim()) {
    answerBox.textContent = "Primero debes cargar un PDF.";
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
      throw new Error(data.error || "Error en OpenAI");
    }

    answerBox.textContent = data.answer;
  } catch (error) {
    answerBox.textContent = "Error: " + error.message;
  }
});

// -----------------------------
// COPIAR RESPUESTA
// -----------------------------
copyBtn.addEventListener("click", async () => {
  const text = answerBox.textContent;

  if (!text || text.includes("aparecerá")) return;

  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = "✓";
    setTimeout(() => (copyBtn.textContent = "⧉"), 1000);
  } catch {
    alert("No se pudo copiar.");
  }
});

// -----------------------------
// GUARDAR RESPUESTA
// -----------------------------
saveBtn.addEventListener("click", () => {
  const text = answerBox.textContent;

  if (!text || text.includes("aparecerá")) return;

  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "respuesta.txt";
  a.click();

  URL.revokeObjectURL(url);
});