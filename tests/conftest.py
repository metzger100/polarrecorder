from __future__ import annotations

from typing import TYPE_CHECKING, Any, Callable, Union

from polarrecorder import commit
from polarrecorder.validation import pipeline

if TYPE_CHECKING:
    from polarrecorder.config import Config
    from polarrecorder.polar_model import PolarModel
    from polarrecorder.sample import ReadResult, Sample
    from polarrecorder.validation.pipeline import PipelineResult
    from polarrecorder.validation.state import ValidationState

RequestHandlerReturn = Union[dict[str, Any], bool, None]


def drive_read_results(
    read_results: list[ReadResult],
    state: ValidationState,
    config: Config,
    model: PolarModel,
) -> list[tuple[PipelineResult, Sample | None]]:
    """Drive reads through the same normal-path orchestration as plugin.py."""
    results: list[tuple[PipelineResult, Sample | None]] = []
    for read_result in read_results:
        pipeline_result, sample = pipeline.run(read_result, state, config)
        if sample is not None:
            state.observe(sample)
        commit.commit_sample(pipeline_result, sample, model)
        results.append((pipeline_result, sample))
    return results


class FakeDataEntry:
    def __init__(
        self,
        value: float,
        timestamp: float,
        source: str = "fake",
        priority: int = 60,
        keep_always: bool = False,
        record: Any | None = None,
    ) -> None:
        self.value = value
        self.timestamp = timestamp
        self.source = source
        self.priority = priority
        self.__dict__["keepAlways"] = keep_always
        self.record = record


class FakeClock:
    def __init__(self, start: float = 1000.0) -> None:
        self.time = start

    def __call__(self) -> float:
        return self.time

    def advance(self, seconds: float) -> None:
        self.time += seconds


class FakeLogger:
    def __init__(self) -> None:
        self.messages: list[tuple[str, str]] = []

    def info(self, msg: str) -> None:
        self.messages.append(("info", msg))

    def warning(self, msg: str) -> None:
        self.messages.append(("warn", msg))

    def debug(self, msg: str) -> None:
        self.messages.append(("debug", msg))

    def error(self, msg: str) -> None:
        self.messages.append(("error", msg))


class FakeAvNavAPI:
    def __init__(self) -> None:
        self.values: dict[str, FakeDataEntry] = {}
        self.config: dict[str, str] = {}
        self.statuses: list[tuple[str, str]] = []
        self.logs: list[tuple[str, str]] = []
        self.saved_configs: list[dict[str, str]] = []
        self.editable_parameters: list[dict[str, Any]] = []
        self.change_callback: Callable[[dict[str, str]], None] | None = None
        self.request_handler: (
            Callable[[str, Any, dict[str, list[str]]], RequestHandlerReturn] | None
        ) = None
        self.restart_callback: Callable[[], None] | None = None
        self.stop_main_thread = False
        self.sequence = 0
        self.user_apps: list[tuple[str, str, str | None]] = []

    def set_value(self, key: str, value: float, timestamp: float) -> None:
        self.values[key] = FakeDataEntry(value=value, timestamp=timestamp)

    def getSingleValue(self, key: str, includeInfo: bool = False) -> float | FakeDataEntry | None:
        entry = self.values.get(key)
        if entry is None:
            return None
        if includeInfo:
            return entry
        return entry.value

    def getExpiryPeriod(self) -> float:
        return 10.0

    def getDataByPrefix(self, prefix: str) -> dict[str, Any]:
        result: dict[str, Any] = {}
        dotted = prefix + "."
        for key in self.values:
            if key.startswith(dotted):
                result[key[len(dotted) :]] = self.values[key].value
        return result

    def fetchFromQueue(
        self,
        sequence: int,
        number: int = 10,
        includeSource: bool = False,
        waitTime: float = 0.5,
        filter: str | list[str] | None = None,  # noqa: A002
    ) -> tuple[int, list[str]]:
        self.sequence = sequence + 1
        return self.sequence, []

    def shouldStopMainThread(self) -> bool:
        return self.stop_main_thread

    def getConfigValue(self, key: str, default: str | None = None) -> str | None:
        return self.config.get(key, default)

    def setStatus(self, value: str, info: str) -> None:
        self.statuses.append((value, info))

    def log(self, format: str, *param: object) -> None:  # noqa: A002
        self.logs.append(("info", format % param if param else format))

    def error(self, format: str, *param: object) -> None:  # noqa: A002
        self.logs.append(("error", format % param if param else format))

    def debug(self, format: str, *param: object) -> None:  # noqa: A002
        self.logs.append(("debug", format % param if param else format))

    def registerEditableParameters(
        self,
        paramList: list[dict[str, Any]],
        changeCallback: Callable[[dict[str, str]], None],
    ) -> None:
        self.editable_parameters = paramList
        self.change_callback = changeCallback

    def registerRequestHandler(
        self,
        callback: Callable[[str, Any, dict[str, list[str]]], RequestHandlerReturn],
    ) -> None:
        self.request_handler = callback

    def registerRestart(self, stopCallback: Callable[[], None]) -> None:
        self.restart_callback = stopCallback

    def saveConfigValues(self, configDict: dict[str, str]) -> None:
        self.saved_configs.append(configDict)

    def getBaseUrl(self) -> str:
        return "/plugins/user-polarrecorder"

    def registerUserApp(
        self,
        url: str,
        iconFile: str,
        title: str | None = None,
        preventConnectionLost: bool = False,
    ) -> str:
        self.user_apps.append((url, iconFile, title))
        return "fake-user-app-id"
