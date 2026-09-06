"""Command stack for Undo/Redo on canvas actions."""

from abc import ABC, abstractmethod
from typing import Callable, Optional


class Command(ABC):
    @abstractmethod
    def execute(self):
        pass

    @abstractmethod
    def undo(self):
        pass


class CommandStack:
    """Simple undo/redo stack."""

    def __init__(self, max_size: int = 100):
        self._undo_stack: list[Command] = []
        self._redo_stack: list[Command] = []
        self._max_size = max_size

    def execute(self, command: Command):
        command.execute()
        self._undo_stack.append(command)
        if len(self._undo_stack) > self._max_size:
            self._undo_stack.pop(0)
        self._redo_stack.clear()

    def undo(self) -> bool:
        if not self._undo_stack:
            return False
        cmd = self._undo_stack.pop()
        cmd.undo()
        self._redo_stack.append(cmd)
        return True

    def redo(self) -> bool:
        if not self._redo_stack:
            return False
        cmd = self._redo_stack.pop()
        cmd.execute()
        self._undo_stack.append(cmd)
        return True

    def can_undo(self) -> bool:
        return bool(self._undo_stack)

    def can_redo(self) -> bool:
        return bool(self._redo_stack)


class LambdaCommand(Command):
    """Command from callables."""

    def __init__(self, do_fn: Callable, undo_fn: Callable):
        self._do = do_fn
        self._undo = undo_fn

    def execute(self):
        self._do()

    def undo(self):
        self._undo()
