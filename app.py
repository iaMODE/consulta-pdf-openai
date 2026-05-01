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
    list_mode = data.get("list_mode", False)

    if not api_key:
        return jsonify({"error": "Falta API Key"}), 400

    if not pdf_text or not question:
        return jsonify({"error": "Faltan datos"}), 400

    detected_articles_text = "No se detectó artículo específico en la pregunta."
    if detected_articles:
        detected_articles_text = ", ".join(str(article) for article in detected_articles)

    list_mode_text = "No"
    if list_mode:
        list_mode_text = "Sí"

    try:
        client = OpenAI(api_key=api_key)

        prompt = f"""
Responde únicamente con base en el siguiente documento cargado por el usuario:

{pdf_text}

Pregunta del usuario:
{question}

Artículo(s) detectado(s) en la pregunta:
{detected_articles_text}

Modo lista o exploración temática:
{list_mode_text}

Reglas obligatorias:
- Responde de forma directa, breve y exacta.
- Usa exclusivamente el texto del documento proporcionado en esta consulta.
- No uses conocimiento externo.
- No inventes información.
- No completes datos ausentes.
- Puedes explicar o reformular el contenido del documento para responder la pregunta, siempre que la respuesta se base estrictamente en el texto proporcionado.
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

Reglas especiales para leyes externas citadas dentro del documento:
- Si el texto proporcionado menciona otra ley, decreto, resolución, código o norma externa, debes tratarla solo como una cita o referencia interna del documento cargado.
- No presentes una ley externa citada como si fuera el documento analizado.
- No expliques el contenido de una ley externa citada, salvo que su contenido aparezca expresamente transcrito en el texto proporcionado.
- Si una ley externa aparece solo mencionada por nombre o número, aclara que está mencionada en el documento cargado, pero no desarrolles su contenido.

Reglas especiales para artículos y párrafos:
- No atribuyas un párrafo al artículo que aparece después de ese párrafo.
- Si un párrafo aparece antes del encabezado de un nuevo artículo, no lo asignes al artículo nuevo.
- Si el contexto muestra que un párrafo continúa de la página anterior, atribúyelo al artículo anterior solo si el encabezado de ese artículo aparece en el texto proporcionado.
- Si no puedes determinar con seguridad a qué artículo pertenece un párrafo, dilo expresamente y no inventes la atribución.

Reglas especiales para modo lista o exploración temática:
- Si el modo lista está activo, organiza la respuesta en viñetas.
- Incluye solo artículos, párrafos o secciones que estén expresamente respaldados por el texto proporcionado.
- Para cada elemento listado, indica el contexto exacto de la mención o del tema.
- No incluyas leyes externas citadas como si fueran artículos del documento cargado.
- Si mencionas una ley externa citada, aclara que es una referencia interna del documento cargado.
- No conviertas una simple cita bibliográfica o referencia normativa externa en un artículo sustantivo del documento analizado.

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
                    "content": "Eres un asistente jurídico documental. Respondes únicamente con base en el documento proporcionado, sin inventar información, sin usar conocimiento externo y citando referencias exactas del texto cargado."
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