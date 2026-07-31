from __future__ import annotations

from polarrecorder.logger import AvNavLogger


class FakeLogAPI:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    def log(self, message_format: str, *param: object) -> None:
        self.calls.append(("log", message_format % param if param else message_format))

    def debug(self, message_format: str, *param: object) -> None:
        self.calls.append(("debug", message_format % param if param else message_format))

    def error(self, message_format: str, *param: object) -> None:
        self.calls.append(("error", message_format % param if param else message_format))


def test_avnav_logger_delegates_all_levels() -> None:
    api = FakeLogAPI()
    logger = AvNavLogger(api)

    logger.info("info message")
    logger.warning("warn message")
    logger.debug("debug message")
    logger.error("error message")

    assert api.calls == [
        ("log", "info message"),
        ("log", "[WARN] warn message"),
        ("debug", "debug message"),
        ("error", "error message"),
    ]
