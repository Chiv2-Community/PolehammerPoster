from __future__ import annotations

import json
from dataclasses import dataclass
from enum import Enum
from functools import reduce
from typing import Any, Callable, List, Optional

from openai import AsyncOpenAI
from openai.types.chat import (ChatCompletionAssistantMessageParam,
                               ChatCompletionMessage,
                               ChatCompletionMessageParam,
                               ChatCompletionMessageToolCall,
                               ChatCompletionMessageToolCallParam,
                               ChatCompletionSystemMessageParam,
                               ChatCompletionToolMessageParam,
                               ChatCompletionToolParam,
                               ChatCompletionUserMessageParam)
from openai.types.chat.chat_completion_message_tool_call_param import \
    Function as ToolCallFunctionParam


class MessageRole(Enum):
    SYSTEM = "system"
    ASSISTANT = "assistant"
    USER = "user"
    TOOL = "tool"


class FinishReason(Enum):
    STOP = "stop"
    LENGTH = "length"
    FUNCTION_CALL = "function_call"
    TOOL_CALLS = "tool_calls"
    CONTENT_FILTER = "content_filter"
    NULL = "null"


@dataclass(frozen=True)
class ChatGPTMessage:
    role: MessageRole
    content: str
    tool_call_id: Optional[str] = None
    tool_calls: Optional[List[ChatCompletionMessageToolCall]] = None
    name: Optional[str] = None

    @staticmethod
    def from_completion_result(message: ChatCompletionMessage) -> ChatGPTMessage:
        if message.role == MessageRole.SYSTEM.value:
            return ChatGPTMessage(
                MessageRole.SYSTEM,
                message.content,
            )
        elif message.role == MessageRole.USER.value:
            return ChatGPTMessage(
                MessageRole.USER,
                message.content,
            )
        elif message.role == MessageRole.ASSISTANT.value:
            return ChatGPTMessage(
                MessageRole.ASSISTANT,
                str(message.content),
                tool_calls=message.tool_calls,
            )
        elif message.role == MessageRole.TOOL.value:
            return ChatGPTMessage(
                MessageRole.TOOL,
                message.content,
                tool_call_id=message.tool_call_id,
            )
        else:
            raise Exception("Invalid message role")

    def to_chatgpt_format(self) -> ChatCompletionMessageParam:
        if self.role == MessageRole.SYSTEM:
            return ChatCompletionSystemMessageParam(
                content=self.content, role=self.role.value
            )
        elif self.role == MessageRole.USER:
            return ChatCompletionUserMessageParam(
                content=self.content, role=self.role.value
            )
        elif self.role == MessageRole.ASSISTANT and self.tool_calls is not None:
            return ChatCompletionAssistantMessageParam(
                content=self.content,
                role=self.role.value,
                tool_calls=self.tool_call_params(),
            )
        elif self.role == MessageRole.ASSISTANT:
            return ChatCompletionAssistantMessageParam(
                content=self.content, role=self.role.value
            )
        elif self.role == MessageRole.TOOL:
            tool_call_id = self.tool_call_id or "error"
            return ChatCompletionToolMessageParam(
                content=self.content, tool_call_id=tool_call_id, role=self.role.value
            )
        else:
            raise Exception("Invalid message role")

    def tool_call_params(self) -> List[ChatCompletionMessageToolCallParam]:
        if self.tool_calls is None:
            return []
        else:
            return list(map(_tool_call_to_tool_call_param, self.tool_calls))


def _tool_call_to_tool_call_param(
    tool_call: ChatCompletionMessageToolCall,
) -> ChatCompletionMessageToolCallParam:
    function_param = ToolCallFunctionParam(
        name=tool_call.function.name,
        arguments=tool_call.function.arguments,
    )

    return ChatCompletionMessageToolCallParam(
        id=tool_call.id, function=function_param, type=tool_call.type
    )


@dataclass(frozen=True)
class ChatGPTFunction:
    name: str
    description: str
    parameters: List[ChatGPTFunctionParam]

    run: Callable[[dict[str, Any]], str]

    def to_chatgpt_format(self) -> ChatCompletionToolParam:
        # Convert parameters to ChatGPT format
        formatted_params = {
            param.name: param.to_chatgpt_format() for param in self.parameters
        }

        # Extract names of required parameters
        required_param_names = [
            param.name for param in self.parameters if param.required
        ]

        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {
                    "type": "object",
                    "properties": formatted_params,
                    "required": required_param_names,
                },
            },
        }


@dataclass(frozen=True)
class ChatGPTFunctionParam:
    name: str
    tpe: str
    required: bool
    description: Optional[str] = None
    enum: Optional[List[str]] = None

    def to_chatgpt_format(self) -> dict[str, object]:
        inner_obj: dict[str, object] = {
            "type": self.tpe,
        }

        if self.enum is not None:
            inner_obj["enum"] = self.enum

        if self.description is not None:
            inner_obj["description"] = self.description

        return {self.name: inner_obj}


@dataclass(frozen=True)
class ChatGPTAgent:
    system_prompt: str
    functions: List[ChatGPTFunction]
    model: str

    client: AsyncOpenAI

    async def respond(self, messages: List[ChatGPTMessage]) -> List[ChatGPTMessage]:
        send_messages = list(
            map(lambda m: m.to_chatgpt_format(), [self._system_message()] + messages)
        )
        function_tools = list(map(lambda f: f.to_chatgpt_format(), self.functions))

        response = None

        if len(function_tools) == 0:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=send_messages,
            )
        else:
            response = await self.client.chat.completions.create(
                model=self.model, messages=send_messages, tools=function_tools
            )

        first_choice = response.choices[0]
        first_choice_message = first_choice.message
        first_choice_reason = FinishReason(first_choice.finish_reason)

        messages = messages + [
            ChatGPTMessage.from_completion_result(first_choice_message)
        ]

        if (
            first_choice_reason == FinishReason.TOOL_CALLS
            and first_choice_message.tool_calls is not None
        ):
            for tool_call in first_choice_message.tool_calls:
                result = self._execute_tool_call(tool_call)
                messages = messages + [result]
        else:
            return messages

        return await self.respond(messages)

    def _execute_tool_call(
        self, tool_call: ChatCompletionMessageToolCall
    ) -> ChatGPTMessage:
        call_id = tool_call.id
        if tool_call.type != "function":
            print("Invalid tool called. Only 'function' type tools are supported.")
            return ChatGPTMessage(
                MessageRole.TOOL,
                "Invalid tool called. Only 'function' type tools are supported.",
                call_id,
                None,
            )

        try:
            print(f"Executing function call {tool_call.function.name}")
            result = self._execute_function(
                tool_call.function.name, json.loads(tool_call.function.arguments)
            )
            return ChatGPTMessage(
                MessageRole.TOOL,
                result,
                tool_call_id=call_id,
                name=tool_call.function.name,
            )
        except Exception as error:
            return ChatGPTMessage(
                MessageRole.TOOL,
                "Failed to execute function call: " + str(error),
                tool_call_id=call_id,
                name=tool_call.function.name,
            )

    def _execute_function(self, function_name: str, arguments: dict[str, Any]) -> str:
        results = [x for x in self.functions if x.name == function_name][:1]
        if len(results) == 0:
            print(
                f"Invalid function call. No function named {function_name} is available."
            )
            return f"Invalid function call. No function named {function_name} is available."

        print(f"Running function {function_name} with arguments {arguments}")

        func = results[0]
        return func.run(arguments)

    def _system_message(self) -> ChatGPTMessage:
        return ChatGPTMessage(MessageRole.SYSTEM, self.system_prompt)
