"""Module: Enhanced Status - Pure live-status state machine for enhanced rules.

Documentation: documentation/architecture/api.md
Depends: polarrecorder.config, polarrecorder.enhanced_input, polarrecorder.sample
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from polarrecorder.sample import ENHANCED_SIGNAL_BY_ROLE, EnhancedSignalSpec

if TYPE_CHECKING:
    from collections.abc import Mapping

    from polarrecorder.config import Config
    from polarrecorder.enhanced_input import EnhancedInput

COMBINATOR_ALL = "all"
COMBINATOR_ANY = "any"


@dataclass(frozen=True)
class EnhancedRuleSpec:
    """Static description of one enhanced rule for status reporting."""

    rule: str
    enable_field: str
    source_roles: tuple[str, ...]
    combinator: str
    threshold_fields: tuple[str, ...]


ENHANCED_RULE_SPECS: tuple[EnhancedRuleSpec, ...] = (
    EnhancedRuleSpec(
        "reject_engine_rpm",
        "enh_rpm_enabled",
        ("rpm",),
        COMBINATOR_ALL,
        ("enh_rpm_idle_max",),
    ),
    EnhancedRuleSpec(
        "reject_engine_on",
        "enh_engine_state_enabled",
        ("engine_signal",),
        COMBINATOR_ALL,
        ("enh_engine_state_on_threshold",),
    ),
    EnhancedRuleSpec(
        "reject_shallow",
        "enh_depth_enabled",
        ("depth_m",),
        COMBINATOR_ALL,
        ("enh_depth_floor_m",),
    ),
    EnhancedRuleSpec(
        "reject_sog_stw_mismatch",
        "enh_slip_enabled",
        ("sog_kt", "current_drift_kt"),
        COMBINATOR_ALL,
        ("enh_slip_sog_floor_kt", "enh_slip_ratio"),
    ),
    EnhancedRuleSpec(
        "reject_true_wind_crosscheck",
        "enh_tw_crosscheck_enabled",
        ("awa_deg", "aws_kt"),
        COMBINATOR_ALL,
        ("enh_tw_twa_tol_deg", "enh_tw_tws_tol_kt"),
    ),
    EnhancedRuleSpec(
        "reject_heel_out_of_band",
        "enh_heel_enabled",
        ("heel_deg",),
        COMBINATOR_ALL,
        ("enh_heel_min_deg", "enh_heel_max_deg"),
    ),
    EnhancedRuleSpec(
        "turn_confirm",
        "enh_turnconfirm_enabled",
        ("heading_deg", "cog_deg"),
        COMBINATOR_ANY,
        ("enh_turn_min_roc",),
    ),
)


def compute_enhanced_status(
    config: Config,
    probes: Mapping[str, EnhancedInput],
) -> list[dict[str, object]]:
    """Resolve the live status of every enhanced rule.

    Args:
        config: Current parsed runtime configuration.
        probes: Per-source-role acquisition state from the canonical input contract.

    Returns:
        One status row per rule with its keys, thresholds, and resolved state.
    """
    return [_rule_row(config, spec, probes) for spec in ENHANCED_RULE_SPECS]


def _rule_row(
    config: Config,
    spec: EnhancedRuleSpec,
    probes: Mapping[str, EnhancedInput],
) -> dict[str, object]:
    enabled = bool(getattr(config, spec.enable_field))
    status = _resolve_status(config, spec, probes, enabled=enabled)
    signals = _signals(spec)
    return {
        "rule": spec.rule,
        "enable_field": spec.enable_field,
        "enabled": enabled,
        "combinator": spec.combinator,
        "keys": [
            {"field": signal.key_field, "key": str(getattr(config, signal.key_field))}
            for signal in signals
        ],
        "thresholds": {field: getattr(config, field) for field in spec.threshold_fields},
        "status": status,
        "availability": _availability(status),
    }


def _availability(status: str) -> str:
    if status in {"active", "disabled"}:
        return status
    return "unavailable"


def _resolve_status(
    config: Config,
    spec: EnhancedRuleSpec,
    probes: Mapping[str, EnhancedInput],
    *,
    enabled: bool,
) -> str:
    if not enabled:
        return "disabled"
    configured_roles = [
        signal.role for signal in _signals(spec) if str(getattr(config, signal.key_field))
    ]
    if not _configuration_satisfies(spec, len(configured_roles)):
        return "inactive_key_not_configured"
    states = [_key_state(probes.get(role)) for role in configured_roles]
    return _status_from_states(spec, states)


def _status_from_states(spec: EnhancedRuleSpec, states: list[str]) -> str:
    if _is_active(spec.combinator, len(spec.source_roles), states):
        return "active"
    if "missing" in states:
        return "inactive_key_missing"
    if "stale" in states:
        return "inactive_value_missing"
    return "inactive_value_invalid"


def _configuration_satisfies(spec: EnhancedRuleSpec, configured_count: int) -> bool:
    if spec.combinator == COMBINATOR_ALL:
        return configured_count == len(spec.source_roles)
    return configured_count >= 1


def _is_active(combinator: str, total_fields: int, states: list[str]) -> bool:
    usable = sum(1 for state in states if state == "usable")
    if combinator == COMBINATOR_ALL:
        return len(states) == total_fields and usable == total_fields
    return usable >= 1


def _key_state(probe: EnhancedInput | None) -> str:
    if probe is None:
        return "missing"
    return probe.state


def _signals(spec: EnhancedRuleSpec) -> tuple[EnhancedSignalSpec, ...]:
    return tuple(ENHANCED_SIGNAL_BY_ROLE[role] for role in spec.source_roles)
