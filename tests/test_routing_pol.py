from __future__ import annotations

from typing import cast

import pytest
from polarrecorder import api_handlers, export, routing_pol
from polarrecorder.projection import ProjectedCell, project_folded_grid


def test_routing_grid_is_fixed_practical_and_absolute() -> None:
    expected_twa = [30, 40, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180]

    assert expected_twa == routing_pol.ROUTING_TWA
    assert routing_pol.ROUTING_TWS == [4, 6, 8, 10, 12, 14, 16, 20, 25]
    assert all(0 < twa <= 180 for twa in routing_pol.ROUTING_TWA)


def test_folded_projection_maps_symmetric_angles() -> None:
    bins = {
        (0, 12): {"histogram": {10: 1}},
        (30, 12): {"histogram": {20: 1}},
        (330, 12): {"histogram": {30: 1}},
        (90, 12): {"histogram": {40: 1}},
        (270, 12): {"histogram": {50: 1}},
        (150, 12): {"histogram": {60: 1}},
        (210, 12): {"histogram": {70: 1}},
        (180, 12): {"histogram": {80: 1}},
    }

    projected = project_folded_grid(bins, [0, 30, 90, 150, 180], [12], 50, 1)

    assert projected[(0, 12)].samples == 1
    assert projected[(30, 12)].samples == 2
    assert projected[(90, 12)].samples == 2
    assert projected[(150, 12)].samples == 2
    assert projected[(180, 12)].samples == 1


def test_folded_projection_merges_histograms_before_floor_and_percentile() -> None:
    bins = {
        (30, 12): {"histogram": {40: 4}},
        (330, 12): {"histogram": {80: 4}},
    }

    projected = project_folded_grid(bins, [30], [12], percentile=65, min_samples=5)

    assert projected[(30, 12)] == ProjectedCell(stw=8.0, samples=8)
    assert export.project_grid(bins, [30], [12], 65, 5) == {}


def test_pol_serialization_is_exact_tabular_crlf_text() -> None:
    projected = {
        (30, 4): ProjectedCell(4.04, 3),
        (30, 6): ProjectedCell(5.16, 3),
        (180, 4): ProjectedCell(6.25, 3),
        (180, 6): ProjectedCell(7.34, 3),
    }

    text = routing_pol.pol_from_projection(projected, [30, 180], [4, 6])

    assert text == "TWA\\TWS\t4\t6\r\n30\t4.0\t5.2\r\n180\t6.2\t7.3\r\n"
    assert ";" not in text


def test_pol_rejects_incomplete_projection_with_counts() -> None:
    projected = {(30, 4): ProjectedCell(4.0, 3)}

    with pytest.raises(
        routing_pol.RoutingPolError,
        match=r"NavimetriX export is incomplete: 3 of 4 polar cells lack sufficient data",
    ):
        routing_pol.pol_from_projection(projected, [30, 180], [4, 6])


def test_complete_routing_export_and_api_never_emit_angles_above_180() -> None:
    bins = {
        (twa, tws): {"histogram": {twa + tws: export.MIN_SAMPLES_DISPLAY}}
        for twa in routing_pol.ROUTING_TWA
        for tws in routing_pol.ROUTING_TWS
    }

    response = api_handlers.format_routing_pol(bins, percentile=65, min_samples=3)
    data = cast("dict[str, object]", response["data"])
    text = cast("str", data["pol"])
    rows = text.splitlines()

    assert response["status"] == "OK"
    assert len(rows) == len(routing_pol.ROUTING_TWA) + 1
    assert [int(row.split("\t", 1)[0]) for row in rows[1:]] == routing_pol.ROUTING_TWA
    assert all(int(row.split("\t", 1)[0]) <= 180 for row in rows[1:])
