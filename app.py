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
                    text += f"\n\n--- PÁGINA {page_number} ---\n"
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

    if not api_key:
        return jsonify({"error": "Falta API Key"}), 400

    if not pdf_text or not question:
        return jsonify({"error": "Faltan datos"}), 400

    try:
        client = OpenAI(api_key=api_key)

        prompt = f"""
Responde únicamente con base en el siguiente documento:

{pdf_text}

Pregunta del usuario:
{question}

Reglas obligatorias:
- Responde de forma directa, breve y exacta.
- Usa exclusivamente el texto del documento proporcionado.
- No uses conocimiento externo.
- No inventes información.
- No completes datos ausentes.
- Si no encuentras base suficiente en el documento proporcionado, responde exactamente:
"No encontré base suficiente en el documento cargado."
- Cada respuesta debe incluir referencias exactas.
- Para documentos jurídicos, prioriza la referencia al artículo.
- Cuando exista artículo, cita primero el artículo y luego la página.
- Si no existe artículo visible, cita página, título, capítulo, sección, numeral o párrafo.
- No cites artículos que no aparezcan en el texto proporcionado.
- No cites páginas que no aparezcan en el texto proporcionado.

Formato de respuesta:
Respuesta:
[respuesta directa]

Referencias:
- [Artículo correspondiente si existe]

Reglas de referencia:
- Si el documento muestra número de página visible (página impresa), úsalo como "Página oficial".
- Si no puedes identificar claramente una página oficial en el texto, NO la inventes.
- Siempre incluye la "Página PDF" basada en el marcador --- PÁGINA X ---.
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