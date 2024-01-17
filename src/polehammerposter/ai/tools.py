import requests

from .ChatGPT import ChatGPTFunction, ChatGPTFunctionParam


def get_weapons(params: dict[str, str]) -> str:
    """Get a list of weapons that satisfy the query constraints"""

    url = "http://localhost:3000/api/weapons"  # Replace with the actual URL of your API

    try:
        response = requests.get(url, params=params)
        response.raise_for_status()  # Raises an HTTPError if the HTTP request returned an unsuccessful status code
        return str(response.json())
    except requests.RequestException as e:
        print(f"An error occurred: {e}")
        return f"An error occurred: {e}"


get_weapons_tool = ChatGPTFunction(
    "getWeapons",
    "Get a list of weapons that satisfy the query constraints",
    [
        ChatGPTFunctionParam(
            "classes",
            "string",
            False,
            "Comma separated list. Apply filter based on class",
            ["ARCHER", "VANGUARD", "FOOTMAN", "KNIGHT", "AVERAGE"],
        ),
        ChatGPTFunctionParam(
            "subclasses",
            "string",
            False,
            "Comma separated list. Apply filter based on subclass",
            [
                "AVERAGE",
                "LONGBOWMAN",
                "CROSSBOWMAN",
                "SKIRMISHER",
                "DEVASTATOR",
                "RAIDER",
                "AMBUSHER",
                "POLEMAN",
                "MAN_AT_ARMS",
                "ENGINEER",
                "OFFICER",
                "GUARDIAN",
                "CRUSADER",
            ],
        ),
        ChatGPTFunctionParam(
            "names",
            "string",
            False,
            "Comma separated list. Apply filter based on weapon name",
        ),
        ChatGPTFunctionParam(
            "damageTypes",
            "string",
            False,
            "Comma separated list. Apply filter based on damage type",
            ["CUT", "CHOP", "BLUNT"],
        ),
        ChatGPTFunctionParam(
            "weaponTypes",
            "string",
            False,
            "Comma separated list. Apply filter based on weapon type",
            [
                "AXE",
                "HAMMER",
                "CLUB",
                "TOOL",
                "POLEARM",
                "SPEAR",
                "SWORD",
                "DAGGER",
                "BOW",
                "TWO_HANDED",
                "ONE_HANDED",
            ],
        ),
        ChatGPTFunctionParam(
            "attackTypes",
            "string",
            False,
            "Comma separated list. Apply filter based on attack type",
            [
                "LIGHT_AVERAGE",
                "HEAVY_AVERAGE",
                "LIGHT_SLASH",
                "LIGHT_OVERHEAD",
                "LIGHT_STAB",
                "HEAVY_SLASH",
                "HEAVY_OVERHEAD",
                "HEAVY_STAB",
                "THROW",
                "SPECIAL",
                "LEAPING_STRIKE",
                "SPRINT_CHARGE",
            ],
        ),
        ChatGPTFunctionParam(
            "sortColumn",
            "string",
            False,
            "Column to sort by",
            [
                "name",
                "damageType",
                "attackType",
                "windup",
                "baseDamage",
                "averageDamage",
                "footmanDamage",
                "knightDamage",
                "holding",
                "release",
                "recovery",
                "combo",
                "range",
                "altRange",
            ],
        ),
        ChatGPTFunctionParam(
            "sortOrder", "string", False, "Sort direction", ["asc", "desc"]
        ),
        ChatGPTFunctionParam("offset", "integer", False, "How many records to skip"),
        ChatGPTFunctionParam("limit", "integer", False, "How many records to return"),
        ChatGPTFunctionParam(
            "partialWeapons",
            "boolean",
            False,
            "If true, only the attacks matched in the query will be returned. Otherwise all weapon attacks will be returned. Defaults to true.",
            ["true", "false"],
        ),
    ],
    get_weapons,
)

add_tool = ChatGPTFunction(
    "addition",
    "Add two numbers",
    [
        ChatGPTFunctionParam("a", "integer", True),
        ChatGPTFunctionParam("b", "integer", True),
    ],
    lambda params: str(float(params["a"]) + float(params["b"])),
)

subtract_tool = ChatGPTFunction(
    "subtraction",
    "Subtract two numbers",
    [
        ChatGPTFunctionParam("a", "integer", True),
        ChatGPTFunctionParam("b", "integer", True),
    ],
    lambda params: str(float(params["a"]) - float(params["b"])),
)

multiply_tool = ChatGPTFunction(
    "multiplication",
    "Multiply two numbers",
    [
        ChatGPTFunctionParam("a", "integer", True),
        ChatGPTFunctionParam("b", "integer", True),
    ],
    lambda params: str(float(params["a"]) * float(params["b"])),
)

divide_tool = ChatGPTFunction(
    "division",
    "Divide two numbers",
    [
        ChatGPTFunctionParam("a", "integer", True),
        ChatGPTFunctionParam("b", "integer", True),
    ],
    lambda params: str(float(params["a"]) / float(params["b"])),
)
