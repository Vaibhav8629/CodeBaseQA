from retriever import retrieve_chunks
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
import os

load_dotenv()

model = ChatGoogleGenerativeAI(
    model="gemini-3.5-flash",
    temperature=0,
    google_api_key=os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
)

def generate_answer(question):
    chunks = retrieve_chunks(question)

    if not chunks:
        return {
            "content": "No relevant code found in the codebase.",
            "sources": []
        }

    context = ""

    for chunk in chunks:
        context += (
            f"\nFile: {chunk['file_path']}\n"
            f"Code:\n{chunk['content']}\n"
        )

    prompt = f"""
You are a codebase question-answering assistant.

Answer the user's question using the provided code context.

Rules:
- Use the code context as the source of truth.
- Mention relevant file paths.
- If the context is insufficient, clearly say so.
- Do not invent functions, files, or implementations.
- Explain the code clearly.

CODE CONTEXT:
{context}

USER QUESTION:
{question}
"""

    response = model.invoke(prompt)

    return {
        "content": response.content,
        "sources": chunks
    }