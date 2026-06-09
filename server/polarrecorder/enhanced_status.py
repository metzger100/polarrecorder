"""Module: Enhanced Status - Pure live-status state machine for enhanced rules.

Documentation: documentation/architecture/api.md
Depends: polarrecorder.config
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Mapping

    from polarrecorder.config import Config

COMBINATOR_ALL = "all"
COMBINATOR_ANY = "any"


@dataclass(frozen=True)
class KeyProbe:
    """Boundary-computed presence/freshness of one store key."""

    present: bool
    fresh: bool


@dataclass(frozen=True)
class EnhancedRuleSpec:
    """Static description of one enhanced rule for status reporting."""

    rule: str
    enable_field: str
    key_fields: tuple[str, ...]
    combinator: str
    threshold_fields: tuple[str, ...]


ENHANCED_RULE_SPECS: tuple[EnhancedRuleSpec, ...] = (
    EnhancedRuleSpec(
        "reject_engine_rpm",
        "enh_rpm_enabled",
        ("enh_rpm_key",),
        COMBINATOR_ALL,
        ("enh_rpm_idle_max",),
    ),
    EnhancedRuleSpec(
        "reject_engine_on",
        "enh_engine_state_enabled",
        ("enh_engine_state_key",),
        COMBINATOR_ALL,
        ("enh_engine_state_on_threshold",),
    ),
    EnhancedRuleSpec(
        "reject_shallow",
        "enh_depth_enabled",
        ("enh_depth_key",),
        COMBINATOR_ALL,
        ("enh_depth_floor_m",),
    ),
    EnhancedRuleSpec(
        "reject_sog_stw_mismatch",
        "enh_slip_enabled",
        ("enh_sog_key", "enh_current_drift_key"),
        COMBINATOR_ALL,
        ("enh_slip_sog_floor_kt", "enh_slip_ratio"),
    ),
    EnhancedRuleSpec(
        "reject_true_wind_crosscheck",
        "enh_tw_crosscheck_enabled",
        ("enh_awa_key", "enh_aws_key"),
        COMBINATOR_ALL,
        ("enh_tw_twa_tol_deg", "enh_tw_tws_tol_kt"),
    ),
    EnhancedRuleSpec(
        "reject_heel_out_of_band",
        "enh_heel_enabled",
        ("enh_heel_key",),
        COMBINATOR_ALL,
        ("enh_heel_min_deg", "enh_heel_max_deg"),
    ),
    EnhancedRuleSpec(
        "turn_confirm",
        "enh_turnconfirm_enabled",
        ("enh_heading_key", "enh_cog_key"),
        COMBINATOR_ANY,
        ("enh_turn_min_roc",),
    ),
)


def compute_enhanced_status(
    config: Config,
    probes: Mapping[str, KeyProbe],
) -> list[dict[str, object]]:
    """Resolve the live status of every enhanced rule.

    Args:
        config: Current parsed runtime configuration.
        probes: Per-store-key presence/freshness computed at the boundary.

    Returns:
        One status row per rule with its keys, thresholds, and resolved state.
    """
    return [_rule_row(config, spec, probes) for spec in ENHANCED_RULE_SPECS]


def _rule_row(
    config: Config,
    spec: EnhancedRuleSpec,
    probes: Mapping[str, KeyProbe],
) -> dict[str, object]:
    enabled = bool(getattr(config, spec.enable_field))
    return {
        "rule": spec.rule,
        "enable_field": spec.enable_field,
        "enabled": enabled,
        "combinator": spec.combinator,
        "keys": [{"field": field, "key": str(getattr(config, field))} for field in spec.key_fields],
        "thresholds": {field: getattr(config, field) for field in spec.threshold_fields},
        "status": _resolve_status(config, spec, probes, enabled=enabled),
    }


def _resolve_status(
    config: Config,
    spec: EnhancedRuleSpec,
    probes: Mapping[str, KeyProbe],
    *,
    enabled: bool,
) -> str:
    if not enabled:
        return "disabled"
    configured_keys = [str(getattr(config, field)) for field in spec.key_fields]
    configured_keys = [key for key in configured_keys if key]
    if not _configuration_satisfies(spec, len(configured_keys)):
        return "inactive_key_not_configured"
    states = [_key_state(probes.get(key)) for key in configured_keys]
    if _is_active(spec.combinator, len(spec.key_fields), states):
        return "active"
    read = any(state in {"fresh", "stale"} for state in states)
    return "inactive_value_missing" if read else "inactive_key_missing"


def _configuration_satisfies(spec: EnhancedRuleSpec, configured_count: int) -> bool:
    if spec.combinator == COMBINATOR_ALL:
        return configured_count == len(spec.key_fields)
    return configured_count >= 1


def _is_active(combinator: str, total_fields: int, states: list[str]) -> bool:
    fresh = sum(1 for state in states if state == "fresh")
    if combinator == COMBINATOR_ALL:
        return len(states) == total_fields and fresh == total_fields
    return fresh >= 1


def _key_state(probe: KeyProbe | None) -> str:
    if probe is None or not probe.present:
        return "missing"
    return "fresh" if probe.fresh else "stale"
