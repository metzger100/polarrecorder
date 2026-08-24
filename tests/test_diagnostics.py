from __future__ import annotations

import json
from copy import deepcopy

from polarrecorder.config import default_config
from polarrecorder.diagnostics import format_sample_diagnostic
from polarrecorder.validation.pipeline import run
from polarrecorder.validation.state import ValidationState
from validation_helpers import make_read_result, make_warmed_state


def test_formatter_includes_replay_values_enhanced_roles_and_config() -> None:
    config = default_config()
    state = make_warmed_state()
    read_result = make_read_result(enhanced_raw={"rpm": (800.0, 99.5), "sog_kt": (2.0, 99.5)})
    result, sample = run(read_result, state, config)

    before = deepcopy(state)
    payload = format_sample_diagnostic(read_result, sample, result, config)

    assert state == before
    assert payload["schema_version"] == 1
    assert payload["core_raw"] == {
        "twa": 90.0,
        "tws_ms": read_result.tws_raw,
        "stw_ms": read_result.stw_raw,
    }
    assert payload["core_normalized"] == {"twa_deg": 90.0, "tws_kt": 12.0, "stw_kt": 6.0}
    assert payload["core_sources"] == {
        "twa": {"timestamp": 99.5, "age_seconds": 0.5},
        "tws": {"timestamp": 99.5, "age_seconds": 0.5},
        "stw": {"timestamp": 99.5, "age_seconds": 0.5},
    }
    assert payload["enhanced"] == {
        "rpm": {
            "raw": 800.0,
            "normalized": 800.0,
            "timestamp": 99.5,
            "age_seconds": 0.5,
        },
        "sog_kt": {
            "raw": 2.0,
            "normalized": 3.88768,
            "timestamp": 99.5,
            "age_seconds": 0.5,
        },
    }
    assert payload["pipeline"] == {
        "decision": "accepted",
        "reason_codes": [],
        "failed_predicates": [],
        "is_sailing_candidate": True,
    }
    assert payload["r15"] == {
        "filled": True,
        "window_span_seconds": 15.0,
        "twa_range": 0.0,
        "tws_range": 0.0,
        "stw_range": 0.0,
    }
    assert payload["config"] == {
        "stability_window_seconds": 15.0,
        "stability_twa_range": 20.0,
        "stability_tws_range": 10.0,
        "stability_stw_range": 4.0,
        "anchoring_speed_floor_kt": 0.5,
        "sog_stw_movement_floor_kt": 1.0,
        "sog_stw_ratio": 0.5,
    }


def test_formatter_preserves_rejected_quarantined_and_predicate_decisions() -> None:
    config = default_config()
    state = make_warmed_state()
    rejected_read = make_read_result(twa_raw=120.0)
    rejected, rejected_sample = run(rejected_read, state, config)
    quarantined_read = make_read_result(tws_kt=4.0, stw_kt=4.0)
    quarantined, quarantined_sample = run(quarantined_read, make_warmed_state(), config)

    rejected_payload = format_sample_diagnostic(rejected_read, rejected_sample, rejected, config)
    quarantined_payload = format_sample_diagnostic(
        quarantined_read, quarantined_sample, quarantined, config
    )

    assert rejected_payload["pipeline"] == {
        "decision": "rejected",
        "reason_codes": ["reject_unstable"],
        "failed_predicates": ["unstable_twa"],
        "is_sailing_candidate": True,
    }
    assert quarantined_payload["pipeline"] == {
        "decision": "quarantined",
        "reason_codes": ["quarantine_engine_suspected"],
        "failed_predicates": ["quarantine_engine_suspected"],
        "is_sailing_candidate": True,
    }


def test_formatter_represents_missing_and_non_finite_values_as_null() -> None:
    config = default_config()
    read_result = make_read_result(twa_raw=float("nan"))
    result, sample = run(read_result, ValidationState(), config)

    payload = format_sample_diagnostic(read_result, sample, result, config)

    assert payload["core_raw"] == {
        "twa": None,
        "tws_ms": read_result.tws_raw,
        "stw_ms": read_result.stw_raw,
    }
    assert payload["core_normalized"] == {"twa_deg": None, "tws_kt": None, "stw_kt": None}
    assert payload["r15"] == {
        "filled": False,
        "window_span_seconds": None,
        "twa_range": None,
        "tws_range": None,
        "stw_range": None,
    }
    assert payload["pipeline"] == {
        "decision": "rejected",
        "reason_codes": ["reject_non_finite_twa"],
        "failed_predicates": ["reject_non_finite_twa"],
        "is_sailing_candidate": False,
    }
    assert "NaN" not in json.dumps(payload, allow_nan=False)


def test_formatter_uses_the_pipeline_current_sample_r15_evaluation() -> None:
    config = default_config()
    state = make_warmed_state()
    read_result = make_read_result(twa_raw=120.0)
    result, sample = run(read_result, state, config)

    payload = format_sample_diagnostic(read_result, sample, result, config)

    assert payload["r15"] == {
        "filled": True,
        "window_span_seconds": 15.0,
        "twa_range": 30.0,
        "tws_range": 0.0,
        "stw_range": 0.0,
    }
