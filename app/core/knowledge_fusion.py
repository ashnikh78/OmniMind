import asyncio
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings
import httpx
from pydantic import BaseModel
import numpy as np
from sentence_transformers import CrossEncoder
from neo4j import AsyncGraphDatabase
from app.core.config import settings
import time

class SearchResult(BaseModel):
    content: str
    source: str
    relevance: float
    metadata: Dict[str, Any]
    embedding: Optional[List[float]] = None
    rerank_score: Optional[float] = None

class EmbeddingCache:
    def __init__(self, ttl: int = 3600):
        self.cache = {}
        self.ttl = ttl
    
    def get(self, key: str) -> Optional[List[float]]:
        if key in self.cache:
            timestamp, embedding = self.cache[key]
            if time.time() - timestamp < self.ttl:
                return embedding
            del self.cache[key]
        return None
    
    def set(self, key: str, embedding: List[float]):
        self.cache[key] = (time.time(), embedding)

class CrossEncoderReranker:
    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        self.model = CrossEncoder(model_name)
    
    async def rerank(self, query: str, results: List[SearchResult]) -> List[SearchResult]:
        if not results:
            return results
        
        # Prepare pairs for reranking
        pairs = [(query, result.content) for result in results]
        
        # Get reranking scores
        scores = self.model.predict(pairs)
        
        # Update results with reranking scores
        for result, score in zip(results, scores):
            result.rerank_score = float(score)
        
        # Sort by reranking score
        results.sort(key=lambda x: x.rerank_score, reverse=True)
        return results

class Neo4jGraph:
    def __init__(self):
        self.driver = AsyncGraphDatabase.driver(settings.NEO4J_URL)
    
    async def search(self, query: str) -> List[Dict[str, Any]]:
        async with self.driver.session() as session:
            result = await session.run(
                """
                CALL db.index.fulltext.queryNodes("content", $query)
                YIELD node, score
                RETURN node.content as content, score, node.metadata as metadata
                LIMIT 10
                """,
                query=query
            )
            return [dict(record) for record in await result.records()]

class ChromaDBVectorSearch:
    def __init__(self):
        self.client = chromadb.Client(Settings(
            chroma_db_impl="duckdb+parquet",
            persist_directory=settings.CHROMA_PERSIST_DIR
        ))
        self.collection = self.client.get_or_create_collection(
            "knowledge_base",
            metadata={"hnsw:space": "cosine"}
        )
        self.embedding_cache = EmbeddingCache(ttl=settings.knowledge.CACHE_TTL)
    
    async def query(self, query: str, user_context: Dict[str, Any]) -> List[SearchResult]:
        # Check cache for query embedding
        cached_embedding = self.embedding_cache.get(query)
        
        results = self.collection.query(
            query_texts=[query],
            n_results=settings.knowledge.MAX_RESULTS,
            include=["documents", "distances", "metadatas", "embeddings"]
        )
        
        # Cache the embedding
        if "embeddings" in results and results["embeddings"]:
            self.embedding_cache.set(query, results["embeddings"][0])
        
        return [
            SearchResult(
                content=doc,
                source="chroma",
                relevance=1 - score,  # Convert distance to similarity
                metadata=metadata,
                embedding=embedding
            )
            for doc, score, metadata, embedding in zip(
                results['documents'][0],
                results['distances'][0],
                results['metadatas'][0],
                results.get('embeddings', [[]])[0]
            )
        ]

class WebSearchAdapter:
    def __init__(self):
        self.client = httpx.AsyncClient()
        self.cache = EmbeddingCache(ttl=settings.knowledge.CACHE_TTL)
    
    async def query(self, query: str, user_context: Dict[str, Any]) -> List[SearchResult]:
        # Implement web search with caching
        return []

class EnterpriseDatabaseConnector:
    def __init__(self):
        self.graph = Neo4jGraph()
        self.cache = EmbeddingCache(ttl=settings.knowledge.CACHE_TTL)
    
    async def query(self, query: str, user_context: Dict[str, Any]) -> List[SearchResult]:
        if not settings.knowledge.GRAPH_ENABLED:
            return []
        
        results = await self.graph.search(query)
        return [
            SearchResult(
                content=result["content"],
                source="enterprise",
                relevance=result["score"],
                metadata=result["metadata"]
            )
            for result in results
        ]

class UserUploadsProcessor:
    def __init__(self):
        self.cache = EmbeddingCache(ttl=settings.knowledge.CACHE_TTL)
    
    async def query(self, query: str, user_context: Dict[str, Any]) -> List[SearchResult]:
        # Implement user uploads search with caching
        return []

class DynamicWeightedFusion:
    def __init__(self):
        self.weights = {
            "chroma": 0.4,
            "web": 0.3,
            "enterprise": 0.2,
            "user_uploads": 0.1
        }
        self.reranker = CrossEncoderReranker()
    
    async def combine(
        self,
        results: Dict[str, List[SearchResult]],
        query: str,
        user_learning_style: Dict[str, Any]
    ) -> List[SearchResult]:
        combined_results = []
        
        # Adjust weights based on user learning style
        if user_learning_style.get("prefers_technical"):
            self.weights["enterprise"] += 0.1
            self.weights["web"] -= 0.1
        
        # Combine and weight results
        for source, source_results in results.items():
            weight = self.weights.get(source, 0.1)
            for result in source_results:
                result.relevance *= weight
                combined_results.append(result)
        
        # Rerank combined results
        if combined_results:
            combined_results = await self.reranker.rerank(query, combined_results)
        
        return combined_results

class KnowledgeFusionEngine:
    def __init__(self):
        self.sources = [
            ChromaDBVectorSearch(),
            WebSearchAdapter(),
            EnterpriseDatabaseConnector(),
            UserUploadsProcessor()
        ]
        self.fusion_strategy = DynamicWeightedFusion()
    
    async def retrieve(self, query: str, user_context: Dict[str, Any]) -> List[SearchResult]:
        # Query all sources concurrently
        results = await asyncio.gather(
            *[source.query(query, user_context) for source in self.sources]
        )
        
        # Combine results with source names
        source_results = {
            source.__class__.__name__.lower(): result
            for source, result in zip(self.sources, results)
        }
        
        # Apply fusion strategy with reranking
        weighted_results = await self.fusion_strategy.combine(
            source_results,
            query=query,
            user_learning_style=user_context.get("learning_profile", {})
        )
        
        return weighted_results 