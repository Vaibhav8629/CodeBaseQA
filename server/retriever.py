from vectorstore import collection, get_embedding

def retrieve_chunks(question, top_k=5):
    print("Question:", question)
    print("Collection count:", collection.count())

    if collection.count() == 0:
        print("Collection is empty!")
        return []

    query_vector = get_embedding(question)
    print("Embedding generated:", len(query_vector))

    results = collection.query(
        query_embeddings=[query_vector],
        n_results=min(top_k, collection.count()),
        include=["documents", "metadatas", "distances"]
    )

    print("Query results:", len(results["documents"][0]))

    chunks = []

    for i in range(len(results["documents"][0])):
        metadata = results["metadatas"][0][i]

        chunks.append({
            "file_path": metadata["file_path"],
            "content": results["documents"][0][i],
            "distance": results["distances"][0][i]
        })

        print(
            "Retrieved file:", metadata["file_path"],
            "| Distance:", results["distances"][0][i]
        )

    return chunks
