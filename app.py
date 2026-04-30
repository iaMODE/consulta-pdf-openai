from flask import Flask, render_template, request, jsonify
import pdfplumber
from openai import OpenAI

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/upload_pdf", methods=["POST"])
def upload_pdf():
    file = request.files.get("file")

    if not file:
        return jsonify({"error": "No se envió ningún archivo"}), 400

    try:
        text = ""
        with pdfplumber.open(file) as pdf:
            for page_number, page in enumerate(pdf.pages, start=1):
                page_text = page.extract_text() or ""
                if page_text.strip():
                    text += f"\n\n--- PÁGINA PDF {page_number} ---\n"
                    text += page_text

        return jsonify({"text": text})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/ask", methods=["POST"])
def ask():
    data = request.json

    pdf_text = data.get("pdf_text")
    question = data.get("question")
    api_key = data.get("api_key")
    detected_articles = data.get("detected_articles", [])

    if not api_key:
        return jsonify({"error": "Falta API Key"}), 400

    if not pdf_text or not question:
        return jsonify({"error": "Faltan datos"}), 400

    detected_articles_text = "No se detectó artículo específico en la pregunta."
    if detected_articles:
        detected_articles_text = ", ".join(str(article) for article in detected_articles)

    try:
        client = OpenAI(api_key=api_key)

        prompt = f"""
Responde únicamente con base en el siguiente documento:

{pdf_text}

Pregunta del usuario:
{question}

Artículo(s) detectado(s) en la pregunta:
{detected_articles_text}

Reglas obligatorias:
- Responde de forma directa, breve y exacta.
- Usa exclusivamente el texto del documento proporcionado.
- No uses conocimiento externo.
- No inventes información.
- No completes datos ausentes.
- Si no encuentras base suficiente en el documento proporcionado, responde exactamente:
"No se encontró base suficiente en el documento cargado."
- Cada respuesta debe incluir referencias exactas.
- Para documentos jurídicos, prioriza la referencia al artículo.
- Si la pregunta menciona un artículo específico, busca y responde prioritariamente sobre ese artículo.
- Cuando exista artículo, cita primero el artículo y luego la página.
- Si no existe artículo visible, cita página, título, capítulo, sección, numeral o párrafo.
- No cites artículos que no aparezcan en el texto proporcionado.
- No cites páginas que no aparezcan en el texto proporcionado.
- La "Página PDF" debe salir únicamente del marcador --- PÁGINA PDF X --- incluido en el texto.
- La "Página oficial" solo debe citarse si aparece claramente como número visible dentro del texto del documento.

Formato de respuesta:
Respuesta:
[respuesta directa]

Referencias:
- Artículo [número], si corresponde.
- Página oficial: [número], solo si está claramente identificada.
- Página PDF: [número].

Reglas de referencia:
- Si el documento muestra número de página visible o impresa, úsalo como "Página oficial".
- Si no puedes identificar claramente una página oficial en el texto, NO la inventes.
- Siempre incluye la "Página PDF" basada en el marcador --- PÁGINA PDF X ---.
- Si existe página oficial, muestra:
  - Página oficial: [número]
  - Página PDF: [número]
- Si NO existe página oficial, muestra SOLO:
  - Página PDF: [número]
"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "Eres un asistente jurídico documental. Respondes únicamente con base en el documento proporcionado, sin inventar información y citando referencias exactas."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.1
        )

        answer = response.choices[0].message.content

        return jsonify({"answer": answer})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)