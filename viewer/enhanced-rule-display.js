/**
 * @file Enhanced-rule display labels
 * Documentation: documentation/architecture/ui.md
 * Depends: (none)
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const Polarrecorder = window.Polarrecorder;
  /** @type {Record<string, string>} */
  const RULE_LABELS = {
    reject_engine_rpm: "Engine RPM",
    reject_engine_on: "Engine on/off",
    reject_shallow: "Shallow water",
    reject_sog_stw_mismatch: "Speed-log sanity (SOG vs STW)",
    reject_true_wind_crosscheck: "Wind sensor cross-check",
    reject_heel_out_of_band: "Heel angle",
    turn_confirm: "Turn vs. wind-shift detection"
  };
  /** @type {Record<string, string>} */
  const STATUS_LABELS = {
    active: "Active",
    disabled: "Disabled",
    inactive_key_not_configured: "No source configured",
    inactive_key_missing: "Source not available",
    inactive_value_missing: "Source data stale"
  };
  /** @type {Record<string, string>} */
  const AVAILABILITY_LABELS = {
    active: "Active",
    disabled: "Disabled",
    unavailable: "Unavailable"
  };

  /** @param {string} rule @returns {string} */
  function ruleLabel(rule) {
    return RULE_LABELS[rule] || rule;
  }

  /** @param {string} status @returns {string} */
  function statusLabel(status) {
    return STATUS_LABELS[status] || status;
  }

  /** @param {string} availability @returns {string} */
  function availabilityLabel(availability) {
    return AVAILABILITY_LABELS[availability] || availability;
  }

  Polarrecorder.EnhancedRuleDisplay = {
    AvailabilityLabel: availabilityLabel,
    RuleLabel: ruleLabel,
    StatusLabel: statusLabel
  };
})();
