from __future__ import annotations

from polarrecorder.logger import AvNavLogger


class FakeLogAPI:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    def log(self, format: str, *param: object) -> None:  # noqa: A002
        self.calls.append(("log", format % param if param else format))

    def debug(self, format: str, *param: object) -> None:  # noqa: A002
        self.calls.append(("debug", format % param if param else format))

    def error(self, format: str, *param: object) -> None:  # noqa: A002
        self.calls.append(("error", format % param if param else format))


def test_avnav_logger_delegates_all_levels() -> None:
    api = FakeLogAPI()
    logger = AvNavLogger(api)

    logger.info("info message")
    logger.warn("warn message")
    logger.debug("debug message")
    logger.error("error message")

    assert api.calls == [
        ("log", "info message"),
        ("log", "[WARN] warn message"),
        ("debug", "debug message"),
        ("error", "error message"),
    ]
