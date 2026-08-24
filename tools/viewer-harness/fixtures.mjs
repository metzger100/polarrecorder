/**
 * @typedef {{ data: unknown, status: string }} ApiResponse
 */

/**
 * @typedef {(endpoint: string) => ApiResponse} ApiResponder
 */

/**
 * @typedef {{
 *   acceptance_rate: number,
 *   total_accepted: number,
 *   total_quarantined: number,
 *   total_rejected: number,
 *   total_seen: number
 * }} StatusCounters
 */

/**
 * @typedef {{
 *   stw_age_s: number,
 *   stw_kt: number,
 *   stw_stale: boolean,
 *   twa_age_s: number,
 *   twa_deg: number,
 *   twa_stale: boolean,
 *   tws_age_s: number,
 *   tws_kt: number,
 *   tws_stale: boolean
 * }} StatusCurrentValues
 */

/**
 * @typedef {{
 *   counters: StatusCounters,
 *   current_decision: { reason_codes: string[], state: string },
 *   current_values: StatusCurrentValues | null,
 *   data_status: string,
 *   generation: number,
 *   persistence: {
 *     bins_total: number,
 *     bins_with_data: number,
 *     file_size_bytes: number,
 *     last_flush_wall: number
 *   },
 *   recording: boolean,
 *   top_predicates: Array<{ count: number, predicate: string }>,
 *   top_rejections: Array<{ count: number, reason: string }>,
 *   uptime_seconds: number,
 *   warming_up: boolean
 * }} StatusPayload
 */

/**
 * @typedef {{ builtin: boolean, name: string, twa: number[], tws: number[] }} PresetFixture
 */

/**
 * @template T
 * @param {T} data
 * @returns {{ data: T, status: string }}
 */
export function ok(data) {
  return { data, status: "OK" };
}

/**
 * @param {string} endpoint
 * @returns {ApiResponse}
 */
export function defaultResponseBody(endpoint) {
  if (endpoint.startsWith("presets")) {
    return ok({ presets: fallbackPresets() });
  }
  if (endpoint.startsWith("polar")) {
    /** @type {Array<{ samples: number, stw: number }>} */
    const curve = [];
    curve[0] = { samples: 0, stw: 0 };
    curve[90] = { samples: 20, stw: 6.2 };
    return ok({
      curves: { 12: curve },
      format: "DefaultStarboard180",
      generation: 2,
      percentile: 65,
      tws_bands: [12]
    });
  }
  if (endpoint.startsWith("status")) {
    return ok(statusPayload());
  }
  if (endpoint.startsWith("timeline")) {
    return ok({
      buckets: [
        { accepted: 2, quarantined: 0, reasons: {}, rejected: 1, t: 1000 },
        { accepted: 1, quarantined: 1, reasons: { r12: 1 }, rejected: 0, t: 1060 }
      ]
    });
  }
  if (endpoint.startsWith("config")) {
    return ok({
      min_samples_for_export: 8,
      percentile: 65,
      stw_key: "gps.waterSpeed",
      twa_key: "gps.trueWindAngle",
      tws_key: "gps.trueWindSpeed"
    });
  }
  if (endpoint.startsWith("enhanced/keys")) {
    return ok({
      keys: ["gps.trueWindAngle", "gps.trueWindSpeed", "gps.waterSpeed", "gps.signalk.navigation.speedThroughWater"]
    });
  }
  if (endpoint.startsWith("advanced/settings")) {
    return ok({
      groups: [
        {
          label: "Sensor Freshness",
          description: "Timing checks for core readings.",
          fields: [
            {
              description: "Rejects old core values.",
              field: "stale_threshold",
              label: "Maximum value age",
              max: 30,
              min: 1,
              step: "0.1",
              type: "FLOAT",
              value: 3
            }
          ]
        }
      ]
    });
  }
  if (endpoint.startsWith("advanced/save")) {
    return ok({ config: { stale_threshold: 3 } });
  }
  if (endpoint.startsWith("export/json")) {
    return ok({ schema_version: 1, bins: {} });
  }
  if (endpoint.startsWith("export/presets")) {
    return ok({ schema_version: 1, presets: {} });
  }
  if (endpoint.startsWith("import/begin")) {
    return ok({ token: "test-token", kind: "learned-data", max_bytes: 4194304, max_chunks: 4096 });
  }
  if (endpoint.startsWith("import/chunk")) {
    return ok({ received: 1, bytes: 12 });
  }
  if (endpoint.startsWith("import/commit")) {
    return ok({
      bins_restored: 4,
      total_accepted: 40,
      migrated_from_version: 1,
      presets_restored: 2
    });
  }
  if (endpoint.startsWith("import/abort")) {
    return ok({});
  }
  if (endpoint.startsWith("export?")) {
    return ok({ csv: "twa/tws,4,6\n0,0.0,0.0\n90,5.0,6.0\n" });
  }
  if (endpoint.startsWith("reset")) {
    return ok({});
  }
  return ok({});
}

/**
 * @param {Partial<StatusPayload>} [overrides]
 * @returns {StatusPayload}
 */
export function statusPayload(overrides = {}) {
  return {
    counters: {
      acceptance_rate: 0.75,
      total_accepted: 30,
      total_quarantined: 2,
      total_rejected: 8,
      total_seen: 40
    },
    current_decision: { reason_codes: [], state: "accepted" },
    current_values: {
      stw_age_s: 0.5,
      stw_kt: 5.9,
      stw_stale: false,
      twa_age_s: 0.3,
      twa_deg: 90,
      twa_stale: false,
      tws_age_s: 0.4,
      tws_kt: 12,
      tws_stale: false
    },
    data_status: "receiving",
    generation: 2,
    persistence: {
      bins_total: 3600,
      bins_with_data: 12,
      file_size_bytes: 1234,
      last_flush_wall: Math.round(Date.now() / 1000) - 120
    },
    recording: true,
    top_predicates: [{ count: 3, predicate: "unstable_twa" }],
    top_rejections: [{ count: 3, reason: "r12" }],
    uptime_seconds: 3600,
    warming_up: false,
    ...overrides
  };
}

/**
 * @returns {PresetFixture[]}
 */
export function fallbackPresets() {
  return [
    { builtin: true, name: "DefaultStarboard180", twa: [0, 90, 180], tws: [4, 6, 8] },
    { builtin: true, name: "DefaultPort180", twa: [180, 270, 345], tws: [4, 6, 8] },
    { builtin: true, name: "Default360", twa: [0, 90, 180, 270], tws: [4, 6, 8] },
    { builtin: true, name: "windy", twa: [0, 30, 40, 52, 60, 90, 120, 150, 180], tws: [4, 6, 8] }
  ];
}
