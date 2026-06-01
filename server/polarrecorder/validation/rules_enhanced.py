"""Module: Enhanced Validation Rules - Future optional-signal rule interface.

Documentation: documentation/architecture/data-pipeline.md
Depends: polarrecorder.sample
"""

from __future__ import annotations

# Future optional-signal rules belong in this module once Phase 4's pure MVP pipeline grows
# beyond TWA/TWS/STW. They should accept only the arguments they use, inspect values from
# Sample.enhanced, and return the shared RuleResult type from polarrecorder.sample.
#
# Planned examples:
# - RPM or engine-state reject: reject when an enhanced engine signal indicates propulsion.
# - Depth reject: reject samples shallower than a configured depth floor.
# - SOG/STW mismatch reject: compare enhanced SOG against core STW for abnormal slip.
# - AWA/AWS true-wind cross-check: recompute true wind from apparent wind and STW, then reject
#   inconsistent TWA/TWS reports.
