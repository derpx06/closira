import apiClient from './apiClient';

/**
 * Service to handle RAG-related operations (Chat, Ingestion, Crawling)
 */
const ragService = {
    /**
     * Send a query to the RAG engine
     */
    async chat(query, sessionId = 'default', companyId = null, websiteId = null) {
        const response = await apiClient.post(
            '/rag/chat',
            {
                query,
                sessionId,
                companyId,
                websiteId
            },
            {
                // RAG chat may take longer on first request (embedding/model warm-up).
                timeout: 0,
            },
        );
        return response.data;
    },

    /**
     * Start a website crawl
     * @param {string} url - URL to crawl
     * @param {number} maxPages - Max pages to crawl
     * @param {boolean} useAdvanced - Use Playwright-based advanced crawler
     * @param {boolean} useAI - Use Gemini to clean crawled content
     * @param {object} auth - Authentication credentials
     */
    async startCrawl(
        url,
        maxPages = 20,
        depthLimit = 2,
        useAdvanced = false,
        useAI = false,
        auth = {},
        options = {}
    ) {
        const response = await apiClient.post(
            '/rag/crawl',
            {
                url,
                maxPages,
                depthLimit,
                useAdvanced,
                useAI,
                auth,
                excludePatterns: options.excludePatterns || [],
                privacyPatterns: options.privacyPatterns || [],
                websiteId: options.websiteId,
                websiteLabel: options.websiteLabel,
            },
            {
                // Crawls can take several minutes for JS-heavy sites.
                timeout: 0,
            },
        );
        return response.data;
    },


    /**
     * Upload and process a document (PDF, DOCX, etc.)
     * @param {File} file - The file object
     * @param {string} base64 - Base64-encoded file content
     */
    async uploadDocument(file, base64) {
        const response = await apiClient.post('/rag/upload', {
            filename: file.name,
            base64,
        });
        return response.data;
    },
    /**
     * Delete all indexed knowledge from Qdrant
     */
    async deleteKnowledgeBase() {
        const response = await apiClient.delete('/rag/knowledge-base');
        return response.data;
    },

    /**
     * Fetch knowledge base stats
     */
    async getKnowledgeBase() {
        const response = await apiClient.get('/rag/knowledge-base');
        return response.data;
    },
    async createKnowledgeSite(label, baseUrl) {
        const response = await apiClient.post('/rag/knowledge-sites', { label, baseUrl });
        return response.data;
    },
    async updateKnowledgeSite(websiteId, payload) {
        const response = await apiClient.patch(`/rag/knowledge-sites/${websiteId}`, payload);
        return response.data;
    },
    async deleteKnowledgeSite(websiteId) {
        const response = await apiClient.delete(`/rag/knowledge-sites/${websiteId}`);
        return response.data;
    },
    async getGroundedObjects(websiteId) {
        const response = await apiClient.get(`/rag/knowledge-sites/${websiteId}/grounded-objects`);
        return response.data;
    },
    async createGroundedObject(websiteId, title, fact) {
        const response = await apiClient.post(`/rag/knowledge-sites/${websiteId}/grounded-objects`, { title, fact });
        return response.data;
    },
    async deleteGroundedObject(websiteId, groundedId) {
        const response = await apiClient.delete(`/rag/knowledge-sites/${websiteId}/grounded-objects/${groundedId}`);
        return response.data;
    },

    /**
     * --- API Keys ---
     */
    async getApiKeys() {
        const response = await apiClient.get('/rag/api-keys');
        return response.data;
    },
    async createApiKey(label, websiteId) {
        const response = await apiClient.post('/rag/api-keys', { label, websiteId });
        return response.data;
    },
    async deleteApiKey(id) {
        const response = await apiClient.delete(`/rag/api-keys/${id}`);
        return response.data;
    },
    async getWidgetConfig() {
        const response = await apiClient.get('/widget/config');
        const payload = response.data;
        return payload?.data ?? payload;
    }
};

export default ragService;
