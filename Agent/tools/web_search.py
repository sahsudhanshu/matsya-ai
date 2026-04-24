import httpx
import os
from dotenv import load_dotenv
from pathlib import Path
from langchain.tools import tool
import asyncio
import json

load_dotenv(Path(__file__).parent.parent.parent / ".env")
TAVILY_SEARCH_URL = "https://api.tavily.com/search"

TAVILY_API_KEY= os.getenv("TAVILY_API_KEY")
max_results=5


@tool
async def web_search(query:str) -> str:

    print("--> web search tool called")

    try:
        async with httpx.AsyncClient() as client:
            response =await client.post(
                TAVILY_SEARCH_URL,
                json={
                    "api_key": TAVILY_API_KEY,
                    "query": query,
                    "max_results": max_results,
                    "search_depth": "basic",
                    "include_answer": True,
                },
            )
            response.raise_for_status()
            response_json=response.json()


        ans:list[str]=[]


        ans.append(f"Web Search Result for the query: {query}\n")
        if(response_json.get("answer")):
            ans.append(f"Answer: {response_json['answer']}\n")

        results = response_json.get("results", [])
        if not results:
            return "\n".join(ans) + "\nNo results found."


        for i, r in enumerate(results, 1):
            title = r.get("title", "No title")
            url = r.get("url", "")
            content = r.get("content", "").strip()
            score = r.get("score", 0)
            if content and len(content) > 400:
                content = content[:400] + "..."
            ans.append(f"**[{i}] {title}**")
            if content:
                ans.append(content)
            ans.append(f"Source: {url}  (relevance: {score:.0%})\n")

        print("\n".join(ans))

    except httpx.RequestError as err:
        return f"Couldn't fetch search results, reason: {err}"

asyncio.run(web_search("What is the current weather in Delhi?"))