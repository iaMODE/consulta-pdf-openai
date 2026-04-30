# Usar imagen oficial de Python
FROM python:3.11-slim

# Evitar archivos .pyc
ENV PYTHONDONTWRITEBYTECODE=1

# Evitar buffer de logs
ENV PYTHONUNBUFFERED=1

# Crear carpeta de trabajo
WORKDIR /app

# Copiar archivos
COPY . .

# Instalar dependencias
RUN pip install --no-cache-dir -r requirements.txt

# Exponer puerto (Cloud Run usa 8080)
EXPOSE 8080

# Comando de ejecución
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "app:app"]