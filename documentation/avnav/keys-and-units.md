# AvNav Keys And Units

**Status:** Current for version 1.0.0.

## Overview

This document lists the AvNav store keys Polar Recorder reads or may use later. AvNav facts cite the verified source tree in `misc/avnav-master/`; Polar Recorder unit conversions are described directly here.

## Key Details

- AvNav's store base key for navigation data is `gps` (`avnav_store.py:34-37`). AvNav key objects prepend that base as `gps.<key>` (`avnav_nmea.py:45-54`), and parsed NMEA data is written below `AVNStore.BASE_KEY_GPS` (`avnav_nmea.py:210-220`).
- `gps.trueWindAngle` comes from `K_TWA=Key('trueWindAngle', ...)`; the key is true wind angle in degrees (`avnav_nmea.py:129-130`). MWV sentences with `T` reference write the angle value directly to the true-wind key (`avnav_nmea.py:485-501`), so Polar Recorder treats AvNav TWA as raw 0-360 degrees.
- `gps.trueWindSpeed` comes from `K_TWS=Key('trueWindSpeed', ..., 'm/s', ...)`; AvNav stores true wind speed in m/s (`avnav_nmea.py:129`). MWV true-wind speed is converted from km/h or knots to m/s when needed and stored on the true-wind speed key (`avnav_nmea.py:496-510`).
- `gps.waterSpeed` comes from `K_VHWS=Key('waterSpeed', 'speed through water', 'm/s', ...)`; AvNav stores speed through water in m/s (`avnav_nmea.py:126`).
- `gps.speed` comes from `K_SOG=Key('speed', 'speed in m/s', 'm/s', ...)`; AvNav stores speed over ground in m/s (`avnav_nmea.py:136-137`).
- `gps.track` comes from `K_COG=Key('track', 'course over ground', degree unit, ...)`; AvNav stores course over ground in degrees (`avnav_nmea.py:136`).
- `gps.headingTrue` comes from `K_HDGT=Key('headingTrue', 'true heading', degree unit, ...)`; AvNav stores true heading in degrees (`avnav_nmea.py:124`).
- `gps.headingMag` comes from `K_HDGM=Key('headingMag', 'magnetic heading', degree unit, ...)`; AvNav stores magnetic heading in degrees (`avnav_nmea.py:123`).
- `gps.windAngle` comes from `K_AWA=Key('windAngle', 'apparent wind angle', degree unit, ...)`; AvNav stores apparent wind angle in degrees (`avnav_nmea.py:127-128`).
- `gps.windSpeed` comes from `K_AWS=Key('windSpeed', 'apparent wind speed', 'm/s', ...)`; AvNav stores apparent wind speed in m/s (`avnav_nmea.py:127`).
- `gps.depthBelowTransducer` comes from `K_DEPTHT=Key('depthBelowTransducer', ..., 'm', ...)`; AvNav stores depth below transducer in meters (`avnav_nmea.py:140`).
- `gps.lat` and `gps.lon` come from `K_LAT=Key('lat', ...)` and `K_LON=Key('lon', ...)`; AvNav stores position as latitude and longitude values (`avnav_nmea.py:134-135`).
- `gps.currentSet` and `gps.currentDrift` come from `K_SET=Key('currentSet', degree unit, ...)` and `K_DFT=Key('currentDrift', ..., 'm/s', ...)`; AvNav stores current set in degrees and current drift in m/s (`avnav_nmea.py:138-139`).
- VWR apparent wind uses port as `360 - windAngle` when the sentence direction is `L`; otherwise it stores the angle directly (`avnav_nmea.py:470-483`). MWV with `T` reference stores true wind angle directly as the numeric sentence angle (`avnav_nmea.py:485-501`).
- AvNav has no VWT parser in the verified source: searching `avnav_nmea.py` finds no `tag == 'VWT'`, while the nearby VWT-looking hit is only `K_VWTT` for water temperature (`avnav_nmea.py:125`, `avnav_nmea.py:169`, `avnav_nmea.py:691`).
- The core key list around AvNav's NMEA definitions includes wind, speed, heading, depth, position, and current keys, but no engine RPM, engine state, heel, or rudder key (`avnav_nmea.py:122-145`, `avnav_nmea.py:156-172`). Searching `avnav_nmea.py` for `RPM`, `rpm`, `engine`, `heel`, and `rudder` returns no core parser key definitions.
- AvNav viewer key definitions expose `nav.gps.trueWindAngle`, `nav.gps.trueWindSpeed`, `nav.gps.waterSpeed`, `nav.gps.speed`, `nav.gps.track`, headings, depth, position, and current keys in the JavaScript-side `nav.gps.*` tree (`viewer/util/keys.jsx:112-150`).
- Each `DataEntry` stores `.value`, `.timestamp`, `.source`, `.priority`, `.keepAlways`, and `.record`; if no timestamp is supplied, AvNav uses `time.monotonic()` (`avnav_store.py:46-56`).
- Store expiry compares `DataEntry.timestamp` to `time.monotonic() - expiryTime` unless `keepAlways` is set (`avnav_store.py:102-108`). `getSingleValue()` returns `None` for missing, expired, or dict-valued entries, returns the `DataEntry` when `includeInfo=True`, and otherwise returns the raw value (`avnav_store.py:260-272`).
- `getExpiryPeriod()` returns the store expiry period in seconds (`avnav_store.py:115-116`).
- Polar Recorder converts AvNav speeds from m/s to knots with `1 m/s = 1.94384 kt` before binning, display, and export.

## Related

- [Plugin lifecycle](../architecture/plugin-lifecycle.md)
- [API shape](../architecture/api.md)
- [Configuration](../user/configuration.md)
