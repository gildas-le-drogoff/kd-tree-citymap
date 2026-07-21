# Visualisateur de villes

Un visualiseur cartographique interactif permettant d'explorer et de rechercher des villes du monde entier, avec leurs données géographiques, démographiques et administratives.

## Fonctionnalités

- Navigation cartographique : Carte interactive avec Leaflet affichant les villes
- Recherche par nom : Recherche instantanée par nom, nom ASCII ou noms vernaculaires
- Visualisation des données : Affichage détaillé de toutes les informations d'une ville (population, coordonnées, fuseau horaire, etc.)
- Recherche par proximité : Cliquez sur la carte pour trouver les villes les plus proches
- Résultats triés : Classement des résultats par population décroissante

## Structure des données

Le projet utilise deux fichiers binaires :

- `ma_base.textindex.bin` : Index textuel pour la recherche rapide par nom
- `ma_base.kdtree.bin` : Arbre KD pour les recherches spatiales (k-plus-proches-voisins)

## Installation

```bash
# Cloner le dépôt
git clone [url-du-depot]
cd kd-tree-citymap

# Installer les dépendances
pnpm install

# Lancer en développement
pnpm run dev

# Construire pour la production
pnpm run build
```

## Utilisation

Utilisation en ligne : [kd-tree-citymap](https://gildas-le-drogoff.github.io/kd-tree-citymap).

## Structure technique

### Architecture TypeScript

- `app.ts` : Point d'entrée, orchestrateur principal
- `binary.ts` : Lecteur de fichiers binaires (petit-boutiste)
- `kdtree.ts` : Implémentation de l'arbre KD pour les recherches spatiales
- `textindex.ts` : Index textuel pour les recherches par nom
- `maptab.ts` : Gestion de la carte Leaflet et des interactions
- `store.ts` : Cache IndexedDB pour les fichiers binaires volumineux
- `theme.ts` : Gestion du thème clair/sombre
- `ui.ts` : Rendu des composants d'interface utilisateur
- `types.ts` : Définitions des types TypeScript

### Formats de données binaires

#### KD-Tree (`*.kdtree.bin`)

- Nœuds internes/feuilles avec coordonnées (lat/lng)
- Index spatial optimisé pour les requêtes de plus proches voisins

#### Index Textuel (`*.textindex.bin`)

- Index trié des noms (insensible à la casse)
- Inclut les noms ASCII et les noms vernaculaires

### Technologies utilisées

- TypeScript : Langage principal
- Leaflet : Bibliothèque de cartographie
- IndexedDB : Cache local pour les données volumineuses
- Vite : Bundler et serveur de développement

## Métriques de performance

- Requêtes textuelles : O(log n) grâce à l'index binaire
- Requêtes spatiales : O(log n) en moyenne avec l'arbre KD
- Cache IndexedDB : réduction des temps de chargement

## Configuration

### Variables d'environnement

- `BASE_URL` : URL de base pour les fichiers binaires
- `KDTREE_URL` : URL personnalisée pour le fichier KD-Tree
- `TEXTINDEX_URL` : URL personnalisée pour le fichier d'index textuel

### Paramètres d'URL

```html
?kdtree=chemin/vers/ma_base.kdtree.bin
?textindex=chemin/vers/ma_base.textindex.bin
```

## Sources de données

Les données proviennent de [Geonames](http://www.geonames.org/) et incluent :

- Populations mondiales
- Coordonnées géographiques
- Noms dans différentes langues
- Informations administratives (pays, provinces)
- Fuseaux horaires
- Altitudes

**Note** : Ce projet est conçu pour être utilisé avec des fichiers de données de taille importante (plusieurs dizaines de Mo). Assurez-vous d'avoir une connexion internet suffisante pour le premier chargement.

## Licence

MIT

# Formats binaires

Toutes les valeurs numériques sont encodées en little-endian. Toute chaîne suit le même encodage : string := u16 len | u8[len] (UTF-8, len = nombre d'octets, pas de caractères). La troncature à l'écriture respecte les frontières de caractères UTF-8 (truncate_utf8).

## 1. *.kdtree.bin — KDTree Binary

### 1.1 Layout général

Header 16 octets puis Nœud 0 variable puis Nœud 1 variable puis ... puis Nœud N-1 variable. Les nœuds ne sont pas triés par offset selon un ordre logique particulier ; chaque nœud est retrouvé par son offset absolu, référencé soit par le header (root_offset), soit par un nœud parent (left_offset/right_offset).

### 1.2 Header (offset 0, 16 octets fixes)

Offset 0 : magic u32 valeur 0x4B445452
Offset 4 : version u32 valeur 4
Offset 8 : node_count u32 nombre total de nœuds du fichier
Offset 12 : root_offset u32 offset absolu du nœud racine (= 16)

### 1.3 Nœud (offset variable, taille variable)

Champs dans l'ordre :

- node_type : u8, toujours présent, 0 = leaf, 1 = internal
- lat : f32, toujours présent, latitude du split point
- lng : f32, toujours présent, longitude du split point
- axis : u8, toujours présent, 0 = split sur lat, 1 = split sur lng
- city_data_len : u32, toujours présent, longueur en octets du bloc CityData qui suit
- city_data : city_data_len octets, toujours présent, voir section 1.4
- left_offset : u32, présent uniquement si node_type==1, offset absolu du fils gauche ; 0 = aucun fils
- right_offset : u32, présent uniquement si node_type==1, offset absolu du fils droit ; 0 = aucun fils

Taille totale d'un nœud : 14 + city_data_len pour leaf, ou 22 + city_data_len pour internal. offset == 0 est la sentinelle "pas d'enfant" — aucun nœud réel ne peut être à l'offset 0 puisque le header occupe déjà [0, 16).

### 1.4 Bloc CityData (longueur variable, champs dans cet ordre exact)

1. id (geonameid) : u32
2. lat : f32
3. lng : f32
4. population : u32
5. elevation : i32
6. dem : i32
7. name : string, longueur max à l'écriture 255
8. ascii_name : string, longueur max à l'écriture 255
9. alternatenames : string, longueur max à l'écriture 65535
10. feature_class : string, longueur max à l'écriture 1 (1 seul caractère)
11. feature_code : string, longueur max à l'écriture 10
12. country_code : string, longueur max à l'écriture 3
13. cc2 : string, longueur max à l'écriture 6
14. admin1_code : string, longueur max à l'écriture 20
15. admin2_code : string, longueur max à l'écriture 20
16. admin3_code : string, longueur max à l'écriture 20
17. admin4_code : string, longueur max à l'écriture 20
18. timezone : string, longueur max à l'écriture 64
19. modification_date : string, longueur max à l'écriture 20
20. vernacular_count : u16
21. vernacular_names[] : vernacular_count × {lang: string≤15, name: string≤255}
22. province_name : string, longueur max à l'écriture 255
23. country_name : string, longueur max à l'écriture 255
24. utc_offset_seconds : i32, i32::MIN = inconnu
25. province_iso_code : string, longueur max à l'écriture 10
26. province_type : string, longueur max à l'écriture 60
27. province_wikidata_id : string, longueur max à l'écriture 20
28. province_names_count : u16
29. province_names[] : province_names_count × {lang: string≤15, name: string≤255}

## 2. *.textindex.bin — Text Index

Index trié pour recherche par préfixe, insensible à la casse, sur name / ascii_name / vernacular_names[].name. Chaque record référence un nœud de *.kdtree.bin par offset — les deux fichiers doivent provenir de la même exécution de kd_generator (les offsets ne sont pas portables d'une génération à l'autre).

### 2.1 Layout général

Header 16 octets puis Offset Table (entry_count × 4) : record_offset[0], record_offset[1], ..., record_offset[entry_count-1] puis Record 0 (variable, à record_offset[0]) puis Record 1 (variable, à record_offset[1]) puis ... puis Record entry_count-1. La table d'offsets a un pas fixe (4 octets), ce qui permet une recherche binaire par index (TextIndexParser::lower_bound) même si les records eux-mêmes ont une longueur variable.

### 2.2 Header (offset 0, 16 octets fixes)

Offset 0 : magic u32 valeur 0x54455849
Offset 4 : version u32 valeur 2
Offset 8 : entry_count u32 nombre de records (après dédup)
Offset 12 : reserved u32 valeur 0

### 2.3 Table d'offsets (offset 16, entry_count × 4 octets)

entry_count × u32 — record_offset[i] = offset absolu (depuis le début du fichier) du record d'indice i, trié selon l'ordre du § 2.5.

### 2.4 Record (offset variable, taille variable)

Champs dans l'ordre :

- str_len : u16, longueur en octets du nom normalisé
- name : str_len octets, nom en minuscules, UTF-8. Diacritiques d'origine conservés pour name, déjà translittéré pour ascii_name, ou nom vernaculaire
- node_offset : u32, offset absolu du nœud correspondant dans *.kdtree.bin
- population : u32, copie de CityData.population — évite de relire le kdtree pour trier

Taille d'un record : 6 + str_len.

### 2.5 Ordre de tri et déduplication

Les records sont triés par ordre lexicographique sur les octets UTF-8 de name, puis par node_offset en cas d'égalité. Les paires exactement identiques (name, node_offset) sont supprimées (text_index::build). Une même ville produit plusieurs records — un par nom indexé (name, ascii_name, chaque vernacular_names[i].name) — tous pointant vers le même node_offset/population. C'est le mécanisme qui permet de retrouver une ville aussi bien par son nom d'origine (avec accents) que par sa forme ASCII ou l'un de ses noms vernaculaires.
