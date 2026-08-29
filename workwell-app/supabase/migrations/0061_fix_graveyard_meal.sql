-- Graveyard was seeded with the same 19:00 meal as Night, which puts the
-- break 2h into an 8h working day (25% around the ring) instead of the
-- intended midpoint. The app's own shift.test.ts expects the midpoint, and
-- the ring's meal label would read "2h in, 6h to go" on the very shift it
-- claims is half-and-half. Move it to 21:00-22:00 (midpoint, like Night).
update work.shifts
   set meal_start = '21:00',
       meal_end   = '22:00'
 where name = 'Graveyard shift'
   and meal_start = '19:00';
