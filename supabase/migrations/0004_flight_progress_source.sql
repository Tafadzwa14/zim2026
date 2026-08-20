-- Track whether a leg's progress came from live radar (OpenSky) or a time
-- estimate, so the flight card can show a Live vs Estimated badge. Safe to re-run.

alter table flight_legs add column if not exists progress_source text
  check (progress_source in ('live','estimated'));
