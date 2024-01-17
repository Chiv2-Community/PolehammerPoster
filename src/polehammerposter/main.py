import asyncio
from os import getenv
from typing import List

import discord
import file_utils
from ai import (ChatGPTAgent, ChatGPTMessage, MessageRole, add_tool,
                divide_tool, get_weapons_tool, multiply_tool, subtract_tool)
from assistants import DiscordAssistant, discord_message_to_chatgpt_message
from discord.ext import commands
from dotenv import load_dotenv
from openai import AsyncOpenAI

def raise_exception(message: str):
    raise Exception(message)

def main():
    load_dotenv()

    bot_token = getenv("DISCORD_API_KEY") or raise_exception("Please set DISCORD_API_KEY in .env")

    # Initialize OpenAI client
    openai_client = AsyncOpenAI(api_key=getenv("OPENAI_API_KEY"))

    # Initialize ChatGPT agents
    weapon_expert_agent = ChatGPTAgent(
        file_utils.load_prompt("weapons-expert.txt"),
        [get_weapons_tool, add_tool, subtract_tool, multiply_tool, divide_tool],
        "gpt-4",
        openai_client,
    )

    prompt_summarizer_agent = ChatGPTAgent(
        file_utils.load_prompt("prompt-summarizer.txt"),
        [],
        "gpt-3.5-turbo",
        openai_client,
    )

    async def summarize_discord_message(message: discord.Message) -> str:
        ai_responses = await prompt_summarizer_agent.respond(
            [discord_message_to_chatgpt_message(message)]
        )
        return ai_responses[-1].content

    # Initialize Discord Assistant
    assistant = DiscordAssistant(
        command_prefix="^",
        intents=discord.Intents.default(),
        openai_client=openai_client,
        communications_agent=weapon_expert_agent,
        thread_title_generator=lambda message: summarize_discord_message(message),
        tracked_threads_file="cache/tracked-threads.txt",
    )

    # Run the bot
    assistant.run(bot_token)


if __name__ == "__main__":
    main()
