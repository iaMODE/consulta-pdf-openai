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
- Responde de forma directa, breve y clara.
- No des explicaciones largas si no son necesarias.
- No uses conocimiento externo.
- No inventes información.
- Si la respuesta no está en el documento, responde exactamente:
"No encontré esa información en el documento cargado."
- Incluye referencias concretas del propio documento: artículo, página, título, capítulo, sección, numeral o párrafo.
- Si el documento no contiene número de página visible, usa la referencia textual más cercana disponible.

Formato de respuesta:
Respuesta:
[respuesta directa]

Referencias:
- [artículo/página/sección/párrafo donde aparece]
"""

        response = client.responses.create(
            model="gpt-4.1-mini",
            input=prompt
        )

        answer = response.output[0].content[0].text

        return jsonify({"answer": answer})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)