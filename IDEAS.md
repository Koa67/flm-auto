# FLM AUTO — Idées à Développer

## 🏠 Dashboard Personnalisable "At Home"

### Concept
Permettre à l'utilisateur de créer sa page d'accueil FLM AUTO personnalisée avec des sources d'information qu'il choisit, pour un effet "chez soi" où tout est adapté à ses goûts et besoins automobiles.

### Sources de contenu configurables

#### YouTube
- Chaînes auto suggérées par FLM AUTO (Automoto, Turbo, Doug DeMuro, Carwow, etc.)
- Recherche et ajout de chaînes par l'utilisateur
- Filtrage par langue, style (reviews, news, tuning, racing...)

#### Réseaux sociaux
- Feeds X/Twitter de journalistes auto, constructeurs, clubs
- Comptes Instagram de marques favorites
- Reddit r/cars, r/electricvehicles, subreddits de marques

#### Sites spécialisés
- Flux RSS de sites auto (Caradisiac, Auto-Moto, Motor1, etc.)
- Alertes occasions (LeBonCoin, La Centrale, AutoScout24)
- News constructeurs officiels

### Personnalisation par filtres

#### Par marques favorites
- Sélection de 1-5 marques prioritaires
- News et sorties de ces marques en avant
- Comparaisons automatiques avec concurrents

#### Par style de voiture
- SUV, berline, sportive, électrique, familiale...
- Filtrage des news et recommandations par segment
- Alertes nouveaux modèles dans le segment

#### Par profil utilisateur (Personas)
- **Famille** : Focus Family Fit, sécurité, volume coffre
- **Passionné** : Performance, tuning, track days
- **Éco-responsable** : Électrique, hybride, consommation
- **Budget serré** : Occasions, fiabilité, coût d'entretien
- **Luxe** : Premium, confort, équipements
- **Jeune conducteur** : Assurance, premiers prix, fiabilité

### Widgets configurables
- Drag & drop pour réorganiser
- Tailles ajustables (petit/moyen/grand)
- Afficher/masquer selon préférences
- Thèmes couleurs par marque favorite

### Exemples de widgets
- 📰 News feed personnalisé
- 🎬 Dernières vidéos YouTube
- 💰 Alertes prix occasions
- 🚗 Nouveaux modèles de mes marques
- 📊 Comparateur rapide
- 🏆 Classements (sécurité, fiabilité, revente)
- 📅 Calendrier sorties futures
- 💬 Discussions communauté

---

## 📝 Notes techniques

### Implémentation suggérée
- Table `user_feeds` : sources RSS/YouTube/X par user
- Table `user_preferences` : marques, segments, persona
- Table `user_widgets` : layout dashboard, positions
- API aggregator pour centraliser les feeds
- Cache Redis pour performance

### Priorité MVP
1. YouTube feeds (API simple)
2. Marques favorites (déjà en DB)
3. Filtres par segment
4. Widgets basiques (news, vidéos)

---

*Ajouté le 07/02/2026*
