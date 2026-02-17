-- Seed: Known engine reliability issues (generic, not tied to specific generations)
-- These are well-documented, widely-reported engine problems

INSERT INTO reliability_issues (
  engine_code, issue_type, severity,
  title, title_fr, description, description_fr,
  symptoms, symptoms_fr,
  affected_years, affected_km_min, affected_km_max,
  repair_cost_eur_min, repair_cost_eur_max,
  source
) VALUES
-- PSA PureTech 1.2 (EB2) — Wet belt disintegration
(
  'EB2', 'common_failure', 'critical',
  'Wet timing belt disintegration',
  'Courroie humide (wet belt) — Désagrégation',
  'The oil-bathed timing belt degrades prematurely, can break and destroy the engine. Affects PureTech 1.2 (110/130hp) produced before mid-2020.',
  'La courroie de distribution baignée dans l''huile se dégrade prématurément, pouvant causer la casse moteur. Concerne les PureTech 1.2 (110/130 ch) produits avant mi-2020.',
  ARRAY['Oil pressure warning light', 'Black residue in oil', 'Knocking noise at startup', 'Sudden power loss'],
  ARRAY['Voyant pression huile', 'Résidus noirs dans l''huile', 'Bruit de claquement au démarrage', 'Perte de puissance soudaine'],
  ARRAY[2014,2015,2016,2017,2018,2019,2020], 30000, 120000,
  800, 5000,
  'PSA recall + class action'
),
-- PSA BlueHDi (DV5/DW10) — AdBlue SCR crystallization
(
  'DV5', 'common_failure', 'major',
  'AdBlue SCR pump crystallization',
  'Cristallisation AdBlue — Panne pompe SCR',
  'The AdBlue (SCR) depollution system crystallizes and blocks the pump. Vehicle refuses to start after countdown. Frequent on 1.5 and 2.0 BlueHDi.',
  'Le système de dépollution AdBlue (SCR) cristallise et bloque la pompe. Le véhicule refuse de démarrer après le compte à rebours.',
  ARRAY['Start impossible in X km message', 'Permanent AdBlue warning', 'Power limitation'],
  ARRAY['Message "Démarrage impossible dans X km"', 'Voyant AdBlue permanent', 'Limitation de puissance'],
  ARRAY[2017,2018,2019,2020,2021,2022,2023], 20000, 100000,
  500, 2500,
  'Forums + DGCCRF reports'
),
-- Renault TCe 1.2/1.3 (H5Ft) — Excessive oil consumption
(
  'H5Ft', 'common_failure', 'major',
  'Excessive oil consumption — Piston ring failure',
  'Surconsommation d''huile excessive',
  'The 1.2 TCe (then 1.3 TCe) engine consumes abnormal amounts of oil due to defective piston rings. Can lead to engine failure if level is not monitored.',
  'Le moteur 1.2 TCe (puis 1.3 TCe) consomme anormalement de l''huile à cause de segments de piston défaillants. Peut mener à la casse moteur.',
  ARRAY['Oil consumption > 0.5L/1000km', 'Blue/black smoke at startup', 'Timing chain rattle when cold'],
  ARRAY['Consommation huile > 0.5L/1000km', 'Fumée bleue/noire au démarrage', 'Claquement chaîne de distribution à froid'],
  ARRAY[2012,2013,2014,2015,2016,2017,2018,2019], 30000, 80000,
  1500, 4000,
  'Renault recall + Dutch class action'
),
-- BMW N47D20 — Rear-mounted timing chain failure
(
  'N47D20', 'common_failure', 'critical',
  'Rear-mounted timing chain premature failure',
  'Chaîne de distribution arrière — Casse prématurée',
  'The timing chain, mounted on the gearbox side (very difficult access), stretches and can break, destroying the engine. Preventive replacement cost is high as engine and gearbox must be separated.',
  'La chaîne de distribution, montée côté boîte de vitesses (accès très difficile), s''allonge et peut casser, détruisant le moteur.',
  ARRAY['Rattling/metallic noise at idle', 'Engine warning light', 'Metallic noise on cold start', 'Timing chain fault codes'],
  ARRAY['Bruit de cliquetis/ferraille au ralenti', 'Voyant moteur allumé', 'Bruit métallique au démarrage à froid', 'Codes défaut chaîne de distribution'],
  ARRAY[2007,2008,2009,2010,2011,2012,2013,2014], 60000, 150000,
  2000, 5000,
  'BMW TSB + specialist forums'
),
-- VAG EA211 TSI — Timing chain tensioner wear
(
  'EA211', 'common_failure', 'major',
  'Timing chain tensioner premature wear',
  'Tendeur de chaîne — Usure prématurée',
  'The EA211 timing chain tensioner wears prematurely, causing excessive play in the chain. Can skip a tooth and cause significant engine damage.',
  'Le tendeur de chaîne de distribution des moteurs EA211 s''use prématurément, provoquant un jeu excessif dans la chaîne.',
  ARRAY['Rattling noise on cold start', 'Intermittent engine warning light', 'Slight power loss', 'Chain noise on deceleration'],
  ARRAY['Bruit de claquement au démarrage à froid', 'Voyant moteur intermittent', 'Légère perte de puissance', 'Bruit de chaîne en décélération'],
  ARRAY[2012,2013,2014,2015,2016,2017,2018,2019], 40000, 120000,
  800, 2500,
  'VAG TSB + specialist forums'
)
ON CONFLICT DO NOTHING;
