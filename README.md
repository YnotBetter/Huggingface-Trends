# Huggingface Model Finder

Eine Webanwendung zum Entdecken und Vergleichen von Huggingface-Modellen für verschiedene AI-Anwendungen.

## Features

- **Kategorien**: LLM, Embedding (RAG), OCR, TTS, STT
- **Zwei Datenquellen**:
  - ⭐ **Empfohlen**: Kuratierte Modelle mit Python-Codebeispielen
  - 🔥 **Trending**: Live von Huggingface API (nach Likes sortiert)
  - 🆕 **Neu**: Neueste Modelle von Huggingface
- **Filter**: Alle Modelle ≤ 20B Parameter
- **Dokumentation**: Eingebettete Python-Codebeispiele für empfohlene Modelle
- **Dark Theme**: Augenfreundliches Design

## Lokale Entwicklung

Einfach die `index.html` in einem Browser öffnen oder einen lokalen Server starten:

```bash
# Mit Python
python -m http.server 8000

# Mit Node.js
npx serve .
```

Dann öffne http://localhost:8000

## Docker Deployment

### Mit Docker Compose (empfohlen)

```bash
# Bauen und starten
docker-compose up -d

# Logs anzeigen
docker-compose logs -f

# Stoppen
docker-compose down
```

Die App ist dann unter http://localhost:8080 erreichbar.

### Mit Docker direkt

```bash
# Image bauen
docker build -t hf-model-finder .

# Container starten
docker run -d -p 8080:80 --name hf-model-finder hf-model-finder
```

## Projektstruktur

```
Huggingface-Trends/
├── index.html          # Hauptseite
├── css/
│   └── styles.css      # Custom Styles
├── js/
│   └── app.js          # Anwendungslogik
├── data/
│   └── models.json     # Kuratierte Modelle
├── Dockerfile          # Docker Image
├── docker-compose.yml  # Docker Compose Config
├── nginx.conf          # Nginx Konfiguration
└── README.md
```

## Modelle hinzufügen

Um eigene Modelle zur kuratierten Liste hinzuzufügen, bearbeite `data/models.json`:

```json
{
  "id": "organisation/model-name",
  "name": "Model Display Name",
  "category": "llm|embedding|ocr|tts|stt",
  "params": "7B",
  "description": "Beschreibung des Modells",
  "use_cases": ["Chat", "Coding"],
  "recommended": true,
  "python_package": "transformers",
  "python_code": "# Python Code hier...",
  "install_cmd": "pip install transformers torch"
}
```

## Technologien

- **Frontend**: Vanilla JavaScript, Tailwind CSS (CDN)
- **Daten**: Huggingface API + lokale JSON
- **Deployment**: nginx (Docker)

## API Limits

Die Huggingface API ist ohne Token auf ca. 100 Requests/Stunde limitiert. Für intensivere Nutzung kann ein Token in `js/app.js` konfiguriert werden.
