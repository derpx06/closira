import torch
from transformers import AutoTokenizer, AutoModel
from fastembed import SparseTextEmbedding


class LocalEmbeddings:
    def __init__(self):
        self.tokenizer = None
        self.model = None
        self.sparse_model = None
        self.model_name = 'sentence-transformers/all-MiniLM-L6-v2'
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'

    def init(self):
        if self.tokenizer is None or self.model is None:
            print(f"[LocalEmbeddings] Loading dense model {self.model_name} on {self.device}...")
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self.model = AutoModel.from_pretrained(self.model_name).to(self.device)
            print("[LocalEmbeddings] Dense model loaded.")
        if self.sparse_model is None:
            print("[LocalEmbeddings] Loading sparse model Splade_PP_en_v1...")
            self.sparse_model = SparseTextEmbedding(model_name="prithvida/Splade_PP_en_v1")
            print("[LocalEmbeddings] Sparse model loaded.")

    def embed_query(self, text: str) -> list[float]:
        self.init()
        inputs = self.tokenizer(text, padding=True, truncation=True, return_tensors="pt").to(self.device)
        with torch.no_grad():
            outputs = self.model(**inputs)
        attention_mask = inputs['attention_mask']
        token_embeddings = outputs[0]
        input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
        sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, 1)
        sum_mask = torch.clamp(input_mask_expanded.sum(1), min=1e-9)
        embeddings = sum_embeddings / sum_mask
        normalized = torch.nn.functional.normalize(embeddings, p=2, dim=1)
        return normalized[0].cpu().tolist()

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        self.init()
        if not texts:
            return []
        inputs = self.tokenizer(texts, padding=True, truncation=True, return_tensors="pt").to(self.device)
        with torch.no_grad():
            outputs = self.model(**inputs)
        attention_mask = inputs['attention_mask']
        token_embeddings = outputs[0]
        input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
        sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, 1)
        sum_mask = torch.clamp(input_mask_expanded.sum(1), min=1e-9)
        embeddings = sum_embeddings / sum_mask
        normalized = torch.nn.functional.normalize(embeddings, p=2, dim=1)
        return normalized.cpu().tolist()

    def embed_sparse_query(self, text: str) -> dict:
        self.init()
        res = list(self.sparse_model.embed([text]))[0]
        return {'indices': res.indices.tolist(), 'values': res.values.tolist()}

    def embed_sparse_documents(self, texts: list[str]) -> list[dict]:
        self.init()
        if not texts:
            return []
        res = list(self.sparse_model.embed(texts))
        return [{'indices': r.indices.tolist(), 'values': r.values.tolist()} for r in res]
