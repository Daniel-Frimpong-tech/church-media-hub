-- Services that repeat every few weeks, not only every week: for example the
-- women's midweek one Wednesday and the men's the next.

alter table public.service_series
  -- 1 = every week, 2 = every other week, up to every 4 weeks.
  add column interval_weeks smallint not null default 1
    check (interval_weeks between 1 and 4),
  -- The first occurrence, on the church's calendar. It fixes which weeks a
  -- series falls on when it does not run every week.
  add column anchor_date date,
  add constraint service_series_anchor_needed
    check (interval_weeks = 1 or anchor_date is not null),
  add constraint service_series_anchor_weekday
    check (anchor_date is null or extract(dow from anchor_date) = weekday);
