from os import getenv
from typing import Awaitable, Callable, List, Optional

import discord
import file_utils
from ai import (ChatGPTAgent, ChatGPTMessage, MessageRole, add_tool,
                divide_tool, get_weapons_tool, multiply_tool, subtract_tool)
from discord.ext import commands
from openai import AsyncOpenAI


def discord_message_to_chatgpt_message(message: discord.Message) -> ChatGPTMessage:
    role: MessageRole = (
        MessageRole.ASSISTANT if message.author.bot else MessageRole.USER
    )
    message_content: str = (
        message.author.display_name + ": " + message.content
        if role == MessageRole.USER
        else message.content
    )
    return ChatGPTMessage(role, message_content)


class DiscordAssistant(commands.Bot):
    def __init__(
        self,
        command_prefix: str,
        intents: discord.Intents,
        openai_client: AsyncOpenAI,
        communications_agent: ChatGPTAgent,
        thread_title_generator: Callable[[discord.Message], Awaitable[str]],
        tracked_threads_file: str,
    ):
        super().__init__(command_prefix=command_prefix, intents=intents)
        self.openai_client: AsyncOpenAI = openai_client
        self.communications_agent: ChatGPTAgent = communications_agent
        self.thread_title_generator: Callable[
            [discord.Message], Awaitable[str]
        ] = thread_title_generator
        self.tracked_threads_file: str = tracked_threads_file
        self.tracked_threads: List[str] = file_utils.load_line_separated_list(
            tracked_threads_file
        )

    async def on_ready(self) -> None:
        print(f"{self.user.name} has connected to Discord!")

    async def on_message(self, message: discord.Message) -> None:
        if message.author == self.user:
            return

        channel: discord.abc.Messageable = message.channel
        is_tracked_thread = str(channel.id) in self.tracked_threads

        if is_tracked_thread or self.user.mentioned_in(message):
            if not isinstance(channel, discord.Thread):
                print(f"Creating thread")
                summary: str = await self.thread_title_generator(message)
                thread: discord.Thread = await channel.create_thread(
                    name=summary, message=message, auto_archive_duration=60
                )
                channel = thread

            if not is_tracked_thread:
                print(f"Tracking thread " + str(channel.id))
                self.tracked_threads.append(str(channel.id))
                file_utils.save_line_separated_list(
                    self.tracked_threads_file, self.tracked_threads
                )

            messages: List[discord.Message] = [
                history_message
                async for history_message in channel.history(limit=10)
                if history_message.content != ""
            ][::-1]

            if len(messages) < 10 and channel.starter_message is not None:
                messages = [channel.starter_message] + messages

            chatgpt_messages: List[ChatGPTMessage] = list(
                map(discord_message_to_chatgpt_message, messages)
            )
            results: List[ChatGPTMessage] = await self.communications_agent.respond(
                chatgpt_messages
            )
            response_text: str = results[-1].content

            await channel.send(response_text)
