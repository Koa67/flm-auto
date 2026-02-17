-- Seed: 10 additional engine reliability issues (expanding from initial 5)
-- Well-documented, widely-reported engine problems

INSERT INTO reliability_issues (
  engine_code, issue_type, severity,
  title, title_fr, description, description_fr,
  symptoms, symptoms_fr,
  affected_years, affected_km_min, affected_km_max,
  repair_cost_eur_min, repair_cost_eur_max,
  source
) VALUES
-- Ford EcoBoost 1.0 (M1DA/M2DA) — Coolant intrusion / cracked cylinder head
(
  'M1DA', 'common_failure', 'critical',
  'Coolant intrusion into cylinders — Cracked head',
  'Intrusion liquide de refroidissement — Culasse fissurée',
  'The 1.0 EcoBoost 3-cylinder can develop coolant leaks into the combustion chamber due to a cracked cylinder head or head gasket failure. Ford extended warranty on some models.',
  'Le 3-cylindres 1.0 EcoBoost peut développer des fuites de liquide de refroidissement dans la chambre de combustion à cause d''une culasse fissurée. Ford a étendu la garantie sur certains modèles.',
  ARRAY['Coolant level dropping without visible leak', 'White smoke from exhaust', 'Overheating', 'Misfire codes', 'Sweet smell from exhaust'],
  ARRAY['Niveau LR qui baisse sans fuite visible', 'Fumée blanche à l''échappement', 'Surchauffe moteur', 'Ratés d''allumage', 'Odeur sucrée à l''échappement'],
  ARRAY[2012,2013,2014,2015,2016,2017,2018], 20000, 100000,
  2000, 6000,
  'Ford TSB + extended warranty program'
),
-- Renault 1.5 dCi K9K — DPF clogging / turbo failure
(
  'K9K', 'common_failure', 'major',
  'DPF clogging and turbo failure on short journeys',
  'Colmatage FAP et casse turbo en trajets courts',
  'The K9K 1.5 dCi, extremely common across Renault/Dacia/Nissan, suffers from premature DPF clogging when used mainly in city driving. Forced regenerations can damage the turbo.',
  'Le K9K 1.5 dCi, très répandu chez Renault/Dacia/Nissan, souffre de colmatage prématuré du FAP en usage urbain. Les régénérations forcées peuvent endommager le turbo.',
  ARRAY['DPF warning light', 'Loss of power', 'Turbo whistle changes', 'Excessive black smoke', 'Limp mode activation'],
  ARRAY['Voyant FAP allumé', 'Perte de puissance', 'Sifflement turbo anormal', 'Fumée noire excessive', 'Passage en mode dégradé'],
  ARRAY[2010,2011,2012,2013,2014,2015,2016,2017,2018,2019], 40000, 150000,
  1000, 3000,
  'Renault TSB + specialist forums'
),
-- BMW N63 (4.4 V8 twin-turbo) — Hot-V oil leaks
(
  'N63', 'common_failure', 'major',
  'Hot-V design oil leaks and valve stem seal failure',
  'Fuites d''huile Hot-V et joints de queues de soupapes',
  'The N63 V8 has turbos mounted in the V between cylinder banks (Hot-V). Extreme heat causes valve stem seal degradation, injector seal leaks, and turbo oil line failures.',
  'Le V8 N63 a les turbos montés dans le V entre les bancs de cylindres (Hot-V). La chaleur extrême dégrade les joints de queues de soupapes, les joints d''injecteurs et les conduites d''huile turbo.',
  ARRAY['Oil consumption >1L/1000km', 'Blue smoke on startup', 'Oil smell in cabin', 'Valve cover gasket leaks', 'Turbo oil line seepage'],
  ARRAY['Consommation huile >1L/1000km', 'Fumée bleue au démarrage', 'Odeur d''huile dans l''habitacle', 'Fuite joint de couvre-culasse', 'Suintement conduites huile turbo'],
  ARRAY[2008,2009,2010,2011,2012,2013], 40000, 120000,
  3000, 8000,
  'BMW TSB (N63 Customer Care Package) + forums'
),
-- Mercedes M271 (1.8 supercharged) — Timing chain and balance shaft
(
  'M271', 'common_failure', 'critical',
  'Timing chain stretch and balance shaft gear failure',
  'Allongement chaîne de distribution et défaillance arbre d''équilibrage',
  'The M271 1.8L supercharged engine suffers from timing chain stretch and balance shaft sprocket failure. The idler gear can shear, causing catastrophic engine damage. Common on C-Class W203/W204, E-Class W211.',
  'Le moteur M271 1.8L compresseur souffre d''allongement de chaîne et de rupture du pignon d''arbre d''équilibrage. Le pignon intermédiaire peut se cisailler, causant la destruction du moteur. Fréquent sur Classe C W203/W204, Classe E W211.',
  ARRAY['Rattling noise on cold start', 'Engine warning light', 'Rough idle', 'Loss of power', 'Metallic debris in oil'],
  ARRAY['Cliquetis au démarrage à froid', 'Voyant moteur allumé', 'Ralenti instable', 'Perte de puissance', 'Particules métalliques dans l''huile'],
  ARRAY[2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012], 60000, 150000,
  2000, 5000,
  'Mercedes TSB + independent specialist data'
),
-- Fiat 1.3 MultiJet (FPT 169A1/199A3) — EGR valve and swirl flaps
(
  '169A1', 'common_failure', 'moderate',
  'EGR valve clogging and intake swirl flap failure',
  'Encrassement vanne EGR et volets de tubulure',
  'The ubiquitous Fiat 1.3 MultiJet diesel suffers from EGR valve clogging (especially in city use) and intake manifold swirl flap failure. Swirl flaps can break off and enter the engine.',
  'Le très répandu Fiat 1.3 MultiJet diesel souffre d''encrassement de la vanne EGR (surtout en ville) et de casse des volets de tubulure d''admission. Les volets peuvent se détacher et entrer dans le moteur.',
  ARRAY['Rough idle', 'Loss of power at low RPM', 'Check engine light', 'Black smoke', 'Poor fuel economy'],
  ARRAY['Ralenti instable', 'Perte de puissance à bas régime', 'Voyant moteur', 'Fumée noire', 'Surconsommation de carburant'],
  ARRAY[2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018], 50000, 200000,
  500, 1500,
  'Fiat TSB + specialist forums'
),
-- VAG EA888 Gen 1/2 (2.0 TSI/TFSI) — Chain tensioner + oil consumption
(
  'EA888', 'common_failure', 'major',
  'Timing chain tensioner failure and oil consumption',
  'Casse tendeur de chaîne et surconsommation d''huile',
  'Early EA888 2.0 TSI/TFSI engines (Gen 1 & 2) suffer from timing chain tensioner failure and excessive oil consumption due to piston ring design. Updated tensioner and revised pistons in Gen 3.',
  'Les premiers moteurs EA888 2.0 TSI/TFSI (Gen 1 et 2) souffrent de casse du tendeur de chaîne et de surconsommation d''huile due aux segments de pistons. Tendeur révisé et pistons modifiés en Gen 3.',
  ARRAY['Rattling on cold start (chain)', 'Oil consumption >0.5L/1000km', 'Blue smoke', 'Engine warning light', 'Oil pressure warning'],
  ARRAY['Cliquetis au démarrage à froid (chaîne)', 'Consommation huile >0.5L/1000km', 'Fumée bleue', 'Voyant moteur', 'Voyant pression d''huile'],
  ARRAY[2008,2009,2010,2011,2012,2013], 40000, 120000,
  1200, 3500,
  'VAG TSB + class action lawsuits'
),
-- Renault 2.0 dCi M9R — Injector seal leaks
(
  'M9R', 'common_failure', 'moderate',
  'Injector copper washer and seal leaks',
  'Fuites joints cuivre injecteurs et joint de culasse',
  'The Renault 2.0 dCi M9R engine develops injector seal leaks (copper washers) causing exhaust gas ingress into the cooling system. Can also develop head gasket issues. Common on Laguna III, Koleos, Trafic.',
  'Le moteur Renault 2.0 dCi M9R développe des fuites au niveau des joints cuivre d''injecteurs, causant une entrée de gaz d''échappement dans le circuit de refroidissement. Peut aussi développer des problèmes de joint de culasse. Fréquent sur Laguna III, Koleos, Trafic.',
  ARRAY['Coolant level dropping', 'Exhaust gas bubbles in coolant tank', 'Diesel smell from exhaust', 'White mayo on oil cap', 'Overheating tendency'],
  ARRAY['Niveau LR qui baisse', 'Bulles de gaz dans le vase d''expansion', 'Odeur diesel à l''échappement', 'Mayonnaise sur le bouchon d''huile', 'Tendance à la surchauffe'],
  ARRAY[2006,2007,2008,2009,2010,2011,2012,2013,2014,2015], 60000, 180000,
  800, 2500,
  'Renault forums + specialist data'
),
-- PSA Prince EP6/EP6DT (1.6 THP/VTi) — Timing chain + valve cover
(
  'EP6', 'common_failure', 'major',
  'Timing chain stretch and valve cover oil leaks',
  'Allongement chaîne de distribution et fuites couvre-culasse',
  'The PSA/BMW Prince engine (1.6 THP/VTi, also N13/N18 in Mini/BMW) suffers from timing chain stretch, hydraulic tensioner failure, and chronic valve cover gasket oil leaks. Very common on 308 I, C4, Mini Cooper S.',
  'Le moteur Prince PSA/BMW (1.6 THP/VTi, aussi N13/N18 chez Mini/BMW) souffre d''allongement de chaîne, de défaillance du tendeur hydraulique, et de fuites chroniques au joint de couvre-culasse. Très fréquent sur 308 I, C4, Mini Cooper S.',
  ARRAY['Rattling noise on cold start', 'Oil leak from valve cover', 'Check engine light (timing)', 'Reduced power', 'Oil on spark plugs'],
  ARRAY['Cliquetis au démarrage à froid', 'Fuite d''huile au couvre-culasse', 'Voyant moteur (distribution)', 'Perte de puissance', 'Huile sur les bougies'],
  ARRAY[2007,2008,2009,2010,2011,2012,2013,2014], 40000, 130000,
  1000, 3000,
  'PSA/BMW TSB + forums spécialisés'
),
-- Toyota 2ZR-FAE (1.8 Valvematic) — Oil consumption
(
  '2ZR-FAE', 'common_failure', 'moderate',
  'Excessive oil consumption — Piston ring design',
  'Surconsommation d''huile — Conception segments de pistons',
  'The Toyota 2ZR-FAE 1.8L Valvematic engine can consume excessive oil due to piston ring design. Toyota issued a TSB and extended warranty for some models. Common on Corolla, Auris, Avensis of that era.',
  'Le moteur Toyota 2ZR-FAE 1.8L Valvematic peut consommer excessivement de l''huile à cause de la conception des segments de pistons. Toyota a émis un TSB et étendu la garantie. Fréquent sur Corolla, Auris, Avensis de cette époque.',
  ARRAY['Oil consumption >0.5L/1000km', 'Low oil level warning', 'No visible external leaks', 'Slight blue tint in exhaust'],
  ARRAY['Consommation huile >0.5L/1000km', 'Voyant niveau d''huile bas', 'Pas de fuite externe visible', 'Légère teinte bleue à l''échappement'],
  ARRAY[2007,2008,2009,2010,2011,2012,2013,2014,2015], 30000, 100000,
  800, 2000,
  'Toyota TSB (EG-052) + owner reports'
),
-- Hyundai/Kia Theta II (2.0/2.4 GDI) — Connecting rod bearing failure
(
  'G4KD', 'common_failure', 'critical',
  'Connecting rod bearing failure — Engine seizure',
  'Casse de bielle — Serrage moteur',
  'The Theta II 2.0/2.4 GDI engines suffer from metal debris from manufacturing contaminating the crankshaft bearings, leading to connecting rod failure and complete engine seizure. Massive recall (>3 million vehicles worldwide).',
  'Les moteurs Theta II 2.0/2.4 GDI souffrent de débris métalliques de fabrication contaminant les coussinets de vilebrequin, menant à la casse de bielle et au serrage complet du moteur. Rappel massif (>3 millions de véhicules dans le monde).',
  ARRAY['Knocking/ticking noise from engine', 'Sudden power loss', 'Engine stall while driving', 'Metal shavings in oil', 'Check engine light with bearing codes'],
  ARRAY['Bruit de cognement/cliquetis du moteur', 'Perte de puissance soudaine', 'Calage moteur en roulant', 'Limaille de fer dans l''huile', 'Voyant moteur avec codes coussinets'],
  ARRAY[2011,2012,2013,2014,2015,2016,2017,2018,2019], 30000, 150000,
  4000, 8000,
  'NHTSA recall 17V-226 + Hyundai/Kia settlement'
)
ON CONFLICT DO NOTHING;
