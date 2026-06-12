"""Minimal logger for Sai."""

import logging
import sys


class Logger:
    _instance = None

    def __init__(self, name="sai"):
        self._logger = logging.getLogger(name)
        self._logger.setLevel(logging.DEBUG)
        if not self._logger.handlers:
            handler = logging.StreamHandler(sys.stdout)
            handler.setLevel(logging.DEBUG)
            fmt = logging.Formatter(
                "[%(asctime)s] %(levelname)s: %(message)s",
                datefmt="%H:%M:%S",
            )
            handler.setFormatter(fmt)
            self._logger.addHandler(handler)

    @classmethod
    def get(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def info(self, msg):
        self._logger.info(msg)

    def debug(self, msg):
        self._logger.debug(msg)

    def warning(self, msg):
        self._logger.warning(msg)

    def error(self, msg):
        self._logger.error(msg)
