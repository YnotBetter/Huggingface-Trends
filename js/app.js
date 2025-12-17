// Huggingface Model Finder - Main Application

// Configuration
const CONFIG = {
    MAX_PARAMS: 20, // Billion
    HF_API_BASE: 'https://huggingface.co/api/models',
    ITEMS_PER_PAGE: 30,
    CATEGORY_FILTERS: {
        llm: 'text-generation',
        embedding: 'feature-extraction',
        ocr: 'image-to-text',
        tts: 'text-to-speech',
        stt: 'automatic-speech-recognition'
    }
};

// State
let state = {
    currentCategory: 'all',
    currentSource: 'recommended',
    searchQuery: '',
    recommendedModels: [],
    apiModels: [],
    isLoading: false
};

// DOM Elements
const elements = {
    modelsGrid: document.getElementById('modelsGrid'),
    loadingState: document.getElementById('loadingState'),
    errorState: document.getElementById('errorState'),
    emptyState: document.getElementById('emptyState'),
    searchInput: document.getElementById('searchInput'),
    modelModal: document.getElementById('modelModal'),
    modalTitle: document.getElementById('modalTitle'),
    modalContent: document.getElementById('modalContent')
};

// Initialize App
async function init() {
    await loadRecommendedModels();
    setupEventListeners();
    renderModels();
}

// Load recommended models from JSON
async function loadRecommendedModels() {
    try {
        const response = await fetch('data/models.json');
        const data = await response.json();
        state.recommendedModels = data.models;
    } catch (error) {
        console.error('Failed to load recommended models:', error);
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Category tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.currentCategory = e.target.dataset.category;
            handleSourceChange();
        });
    });

    // Source buttons (Empfohlen/Trending/Neu)
    document.querySelectorAll('.source-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.currentSource = e.target.dataset.source;
            handleSourceChange();
        });
    });

    // Search input
    elements.searchInput.addEventListener('input', debounce((e) => {
        state.searchQuery = e.target.value.toLowerCase();
        renderModels();
    }, 300));

    // Modal close on backdrop click
    elements.modelModal.addEventListener('click', (e) => {
        if (e.target === elements.modelModal) {
            closeModal();
        }
    });

    // ESC key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}

// Handle source change
async function handleSourceChange() {
    if (state.currentSource === 'recommended') {
        renderModels();
    } else {
        await fetchFromHuggingface();
    }
}

// Fetch models from Huggingface API
async function fetchFromHuggingface() {
    setLoading(true);

    try {
        const sort = state.currentSource === 'trending' ? 'likes' : 'lastModified';
        const direction = -1; // Descending

        let url = `${CONFIG.HF_API_BASE}?sort=${sort}&direction=${direction}&limit=${CONFIG.ITEMS_PER_PAGE}`;

        // Add category filter if not "all"
        if (state.currentCategory !== 'all') {
            const filter = CONFIG.CATEGORY_FILTERS[state.currentCategory];
            if (filter) {
                url += `&filter=${filter}`;
            }
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error('API request failed');

        const models = await response.json();

        // Filter by parameter size (≤20B) and transform data
        state.apiModels = models
            .filter(model => {
                // Try to extract parameter count from model info
                const params = extractParamCount(model);
                return params === null || params <= CONFIG.MAX_PARAMS;
            })
            .map(model => transformApiModel(model));

        renderModels();
    } catch (error) {
        console.error('Failed to fetch from Huggingface:', error);
        showError();
    } finally {
        setLoading(false);
    }
}

// Extract parameter count from model data
function extractParamCount(model) {
    // Check safetensors info first
    if (model.safetensors?.total) {
        const billions = model.safetensors.total / 1e9;
        return billions;
    }

    // Try to extract from model name
    const name = model.modelId || model.id || '';
    const match = name.match(/(\d+(?:\.\d+)?)\s*[Bb]/);
    if (match) {
        return parseFloat(match[1]);
    }

    return null; // Unknown size
}

// Transform API model to our format
function transformApiModel(model) {
    const category = detectCategory(model);
    const params = extractParamCount(model);

    return {
        id: model.modelId || model.id,
        name: (model.modelId || model.id).split('/').pop(),
        category: category,
        params: params ? `${params.toFixed(1)}B` : 'Unknown',
        description: model.description || `${model.downloads?.toLocaleString() || 0} Downloads | ${model.likes?.toLocaleString() || 0} Likes`,
        use_cases: model.tags?.slice(0, 4) || [],
        recommended: false,
        downloads: model.downloads || 0,
        likes: model.likes || 0,
        lastModified: model.lastModified,
        fromApi: true
    };
}

// Detect category from model tags/pipeline
function detectCategory(model) {
    const pipeline = model.pipeline_tag || '';
    const tags = model.tags || [];

    if (pipeline === 'text-generation' || tags.includes('text-generation')) return 'llm';
    if (pipeline === 'feature-extraction' || tags.includes('sentence-similarity')) return 'embedding';
    if (pipeline === 'image-to-text' || tags.includes('ocr')) return 'ocr';
    if (pipeline === 'text-to-speech' || tags.includes('tts')) return 'tts';
    if (pipeline === 'automatic-speech-recognition' || tags.includes('speech')) return 'stt';

    return 'llm'; // Default
}

// Render models to grid
function renderModels() {
    const models = getFilteredModels();

    if (models.length === 0) {
        elements.modelsGrid.innerHTML = '';
        elements.emptyState.classList.remove('hidden');
        return;
    }

    elements.emptyState.classList.add('hidden');
    elements.modelsGrid.innerHTML = models.map(model => createModelCard(model)).join('');
}

// Get filtered models based on current state
function getFilteredModels() {
    let models = state.currentSource === 'recommended'
        ? state.recommendedModels
        : state.apiModels;

    // Filter by category
    if (state.currentCategory !== 'all') {
        models = models.filter(m => m.category === state.currentCategory);
    }

    // Filter by search query
    if (state.searchQuery) {
        models = models.filter(m =>
            m.name.toLowerCase().includes(state.searchQuery) ||
            m.description?.toLowerCase().includes(state.searchQuery) ||
            m.id?.toLowerCase().includes(state.searchQuery)
        );
    }

    return models;
}

// Create model card HTML
function createModelCard(model) {
    const categoryBadge = getCategoryBadge(model.category);
    const useCases = model.use_cases?.slice(0, 3).map(uc =>
        `<span class="use-case-tag">${uc}</span>`
    ).join('') || '';

    return `
        <div class="model-card bg-dark-card border border-dark-border rounded-xl p-4 cursor-pointer"
             onclick="openModal('${model.id}')">
            <div class="flex items-start justify-between mb-3">
                <div class="flex-1 min-w-0">
                    <h3 class="font-semibold text-lg truncate">${model.name}</h3>
                    <p class="text-dark-muted text-sm truncate">${model.id}</p>
                </div>
                ${model.recommended ? '<span class="recommended-badge badge ml-2">⭐</span>' : ''}
            </div>

            <div class="flex flex-wrap gap-2 mb-3">
                ${categoryBadge}
                <span class="param-badge badge">${model.params}</span>
            </div>

            <p class="text-dark-muted text-sm mb-3 line-clamp-2">${model.description || ''}</p>

            <div class="flex flex-wrap gap-1 mb-3">
                ${useCases}
            </div>

            ${model.fromApi ? `
                <div class="flex gap-4 text-sm">
                    <span class="stat-item">⬇️ ${formatNumber(model.downloads)}</span>
                    <span class="stat-item">❤️ ${formatNumber(model.likes)}</span>
                </div>
            ` : ''}
        </div>
    `;
}

// Get category badge HTML
function getCategoryBadge(category) {
    const badges = {
        llm: '<span class="badge badge-llm">🧠 LLM</span>',
        embedding: '<span class="badge badge-embedding">🔗 Embedding</span>',
        ocr: '<span class="badge badge-ocr">👁️ OCR</span>',
        tts: '<span class="badge badge-tts">🔊 TTS</span>',
        stt: '<span class="badge badge-stt">🎤 STT</span>'
    };
    return badges[category] || '';
}

// Open model detail modal
function openModal(modelId) {
    const model = [...state.recommendedModels, ...state.apiModels].find(m => m.id === modelId);
    if (!model) return;

    elements.modalTitle.textContent = model.name;
    elements.modalContent.innerHTML = createModalContent(model);
    elements.modelModal.classList.remove('hidden');
    elements.modelModal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

// Close modal
function closeModal() {
    elements.modelModal.classList.add('hidden');
    elements.modelModal.classList.remove('flex');
    document.body.style.overflow = '';
}

// Create modal content HTML
function createModalContent(model) {
    const hfUrl = `https://huggingface.co/${model.id}`;

    let content = `
        <div class="space-y-6">
            <!-- Header Info -->
            <div class="flex flex-wrap gap-2">
                ${getCategoryBadge(model.category)}
                <span class="param-badge badge">${model.params}</span>
                ${model.recommended ? '<span class="recommended-badge badge">⭐ Empfohlen</span>' : ''}
            </div>

            <!-- Description -->
            <div>
                <h4 class="font-semibold mb-2">Beschreibung</h4>
                <p class="text-dark-muted">${model.description || 'Keine Beschreibung verfügbar.'}</p>
            </div>

            <!-- Use Cases -->
            ${model.use_cases?.length ? `
                <div>
                    <h4 class="font-semibold mb-2">Anwendungsfälle</h4>
                    <div class="flex flex-wrap gap-2">
                        ${model.use_cases.map(uc => `<span class="use-case-tag">${uc}</span>`).join('')}
                    </div>
                </div>
            ` : ''}

            <!-- Links -->
            <div>
                <h4 class="font-semibold mb-2">Links</h4>
                <a href="${hfUrl}" target="_blank" rel="noopener"
                   class="external-link inline-flex items-center gap-2">
                    🤗 Auf Huggingface öffnen
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                    </svg>
                </a>
            </div>
    `;

    // Python code section (only for recommended models with code)
    if (model.python_code) {
        content += `
            <!-- Installation -->
            <div>
                <h4 class="font-semibold mb-2">📦 Installation</h4>
                <div class="code-block relative">
                    <button class="copy-btn" onclick="copyCode(this, '${escapeForAttr(model.install_cmd)}')">
                        Kopieren
                    </button>
                    <pre><code>${escapeHtml(model.install_cmd)}</code></pre>
                </div>
            </div>

            <!-- Python Code -->
            <div>
                <h4 class="font-semibold mb-2">🐍 Python Code</h4>
                <div class="code-block relative">
                    <button class="copy-btn" onclick="copyCode(this, \`${escapeForAttr(model.python_code)}\`)">
                        Kopieren
                    </button>
                    <pre><code>${escapeHtml(model.python_code)}</code></pre>
                </div>
            </div>
        `;
    } else if (model.fromApi) {
        // Generic code template for API models
        const genericCode = generateGenericCode(model);
        content += `
            <!-- Generic Python Code -->
            <div>
                <h4 class="font-semibold mb-2">🐍 Python Code (Generisch)</h4>
                <p class="text-dark-muted text-sm mb-2">
                    ⚠️ Dies ist ein generisches Beispiel. Prüfe die Huggingface-Seite für spezifische Anweisungen.
                </p>
                <div class="code-block relative">
                    <button class="copy-btn" onclick="copyCode(this, \`${escapeForAttr(genericCode)}\`)">
                        Kopieren
                    </button>
                    <pre><code>${escapeHtml(genericCode)}</code></pre>
                </div>
            </div>
        `;
    }

    content += '</div>';
    return content;
}

// Generate generic Python code based on category
function generateGenericCode(model) {
    const templates = {
        llm: `from transformers import AutoModelForCausalLM, AutoTokenizer

model_name = "${model.id}"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(model_name, device_map="auto")

# Beispiel-Nutzung
inputs = tokenizer("Hello, how are you?", return_tensors="pt").to(model.device)
outputs = model.generate(**inputs, max_new_tokens=100)
print(tokenizer.decode(outputs[0], skip_special_tokens=True))`,

        embedding: `from sentence_transformers import SentenceTransformer

model = SentenceTransformer("${model.id}")

# Texte einbetten
sentences = ["This is a sentence.", "This is another sentence."]
embeddings = model.encode(sentences)

print(f"Embedding shape: {embeddings.shape}")`,

        ocr: `from transformers import pipeline

pipe = pipeline("image-to-text", model="${model.id}")

# Bild verarbeiten
result = pipe("image.png")
print(result)`,

        tts: `from transformers import pipeline

pipe = pipeline("text-to-speech", model="${model.id}")

# Text zu Sprache
result = pipe("Hello, this is a test.")
# result["audio"] enthält die Audio-Daten`,

        stt: `from transformers import pipeline

pipe = pipeline("automatic-speech-recognition", model="${model.id}")

# Audio transkribieren
result = pipe("audio.mp3")
print(result["text"])`
    };

    return templates[model.category] || templates.llm;
}

// Copy code to clipboard
async function copyCode(button, code) {
    try {
        await navigator.clipboard.writeText(code);
        const originalText = button.textContent;
        button.textContent = 'Kopiert!';
        setTimeout(() => {
            button.textContent = originalText;
        }, 2000);
    } catch (err) {
        console.error('Failed to copy:', err);
    }
}

// Utility functions
function setLoading(isLoading) {
    state.isLoading = isLoading;
    elements.loadingState.classList.toggle('hidden', !isLoading);
    elements.modelsGrid.classList.toggle('hidden', isLoading);
}

function showError() {
    elements.errorState.classList.remove('hidden');
    elements.modelsGrid.classList.add('hidden');
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num?.toString() || '0';
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeForAttr(str) {
    return str.replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
