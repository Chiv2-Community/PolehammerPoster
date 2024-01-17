import os
from typing import List


def load_prompt(path: str) -> str:
    with open(path, "r") as file:
        return file.read()


def load_line_separated_list(path: str) -> List[str]:
    if not os.path.exists(path):
        return []

    with open(path, "r") as file:
        return file.readlines()


def save_line_separated_list(path: str, lst: List[str]):
    with open(path, "w") as file:
        file.write("\n".join(lst))
