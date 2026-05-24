FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt requirements-ai.txt ./
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir -r requirements-ai.txt
COPY app ./app
COPY run.py .
EXPOSE 5001
CMD ["python3", "run.py"]
