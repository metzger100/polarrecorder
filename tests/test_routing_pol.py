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
    # Projection keeps a head-to-wind point the file never serializes.
    assert [0, *routing_pol.ROUTING_TWA] == routing_pol.PROJECTION_TWA


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

    # Adrena and SailGrib document the slash spelling; qtVlm accepts either. CSV keeps
    # its own backslash header, so the two formats do not share a first cell.
    assert text == "TWA/TWS\t4\t6\r\n30\t4.0\t5.2\r\n180\t6.2\t7.3\r\n"
    assert "\\" not in text
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

    response = api_handlers.format_routing_pol(bins, percentile=65, min_samples=3, max_tws=60)
    data = cast("dict[str, object]", response["data"])
    text = cast("str", data["pol"])
    rows = text.splitlines()

    assert response["status"] == "OK"
    assert len(rows) == len(routing_pol.ROUTING_TWA) + 1
    assert [int(row.split("\t", 1)[0]) for row in rows[1:]] == routing_pol.ROUTING_TWA
    assert all(int(row.split("\t", 1)[0]) <= 180 for row in rows[1:])


def test_samples_nearer_the_bow_than_any_sailing_angle_never_set_the_first_row() -> None:
    bins = {
        (10, 12): {"histogram": {30: 5}},
        (30, 12): {"histogram": {60: 5}},
    }

    projected = project_folded_grid(bins, routing_pol.PROJECTION_TWA, [12], 65, 1)

    # The 10 deg bin lands in the discarded head-to-wind bucket, so the exported
    # 30 deg cell carries only its own five samples at 6.0 kt.
    assert projected[(30, 12)] == ProjectedCell(stw=6.0, samples=5)
    assert projected[(0, 12)].samples == 5


def test_routing_tws_grid_drops_columns_the_wind_ceiling_can_never_fill() -> None:
    assert routing_pol.routing_tws_grid(60) == routing_pol.ROUTING_TWS
    assert routing_pol.routing_tws_grid(25) == routing_pol.ROUTING_TWS
    assert routing_pol.routing_tws_grid(22) == [4, 6, 8, 10, 12, 14, 16, 20]
    assert routing_pol.routing_tws_grid(20) == [4, 6, 8, 10, 12, 14, 16, 20]


def test_export_succeeds_at_max_tws_20_where_the_25_knot_column_is_unreachable() -> None:
    reachable = routing_pol.routing_tws_grid(20)
    bins = {
        (twa, tws): {"histogram": {twa + tws: export.MIN_SAMPLES_DISPLAY}}
        for twa in routing_pol.ROUTING_TWA
        for tws in reachable
    }

    text = routing_pol.routing_pol_export(bins, percentile=65, min_samples=3, max_tws=20)
    rows = text.splitlines()

    assert rows[0] == "TWA/TWS\t" + "\t".join(str(tws) for tws in reachable)
    assert len(rows) == len(routing_pol.ROUTING_TWA) + 1
    # The same learned model still fails at max_tws=60, where 25 knots is recordable.
    with pytest.raises(routing_pol.RoutingPolError, match=r"12 of 108 polar cells"):
        routing_pol.routing_pol_export(bins, percentile=65, min_samples=3, max_tws=60)
