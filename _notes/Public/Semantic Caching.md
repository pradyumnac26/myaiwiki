---
title: Semantic Caching
date: 2026-03-12
feed: show
---

***Quick Recap*** : We already know about traditional caching that helps in reducing latency and database load. When the same query is likely to be asked repeatedly, the cache stores the result as a `<key, value>` pair, where the key uniquely identifies the request and the value is the corresponding response. The next time that exact query comes in, the cache serves the stored answer instead of hitting the database again.

Semantic caching applies the same idea to LLM-powered applications, but with a tiny tweak. 

## How semantic caching works

Instead of matching queries by exact string, semantic caching matches them by semantic similarity that is by _meaning_. When a new query comes in, it's first converted into an embedding a vector representation of its meaning. That embedding is then compared against the embeddings already stored in the cache (cache key) using cosine similarity. 

If the similarity score passes a set threshold (typically somewhere between 0.85 and 0.95 (we will see why this range in particular late in the note)), the cache treats the new query as equivalent to a previously seen one. So during search if a sufficiently similar cached query is found, the system reuses the previously generated response instead of invoking the LLM again.  It not only saved on latency, but it also saved on the token cost of an LLM call.


![](/notes/semantic_cache_miss.png)
![](/notes/semantic_cache_miss.png)

The search that happens here is a vector search that uses approximate nearest-neighbor algorithms like HNSW or libraries like FAISS rather than a brute-force comparison against every cached embedding, which is what keeps the lookup fast as the cache grows.
## The core trade-off: accuracy vs. cost savings

The catch is the threshold. While doing Cosine similarity, we need to decide on what is the best threshold, because here the threshold is what decides if 2 embeddings are close enough or not close enough.

- **Threshold set too high** : the cache becomes becomes strict and the cache barely gets used  and we might lose on the cost and latency benefit it was supposed to provide.
- **Threshold set too low** : the cache becomes too easy meaning even if 2 sentences are not similar it will start treating them as similar and would surface wrong answers confidently to the users, which is worst than a cache miss.

------------------------------ 

**A quick note on cache size:** Without any proper cache eviction strategies the cache would grow infinitly, and in turn increases the lookup latency as well as the storage cost for the cache.

> So what eviction strategies can be used ? 

So the same eviction strategies used in traditional caching still apply here, like LRU (drop whatever hasn't been used recently) or TTL (expire entries after a set time), to keep the cache lean and performant.

> Where are the embeddings actually generated?

We generate these embeddings on the backend/application side. We utilize an embedding model to convert it into a vector. 

> Couple of cache services built for this purpose ? 

GPTCache (open source library), Redis
