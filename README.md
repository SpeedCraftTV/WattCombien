# WattCombien

Site statique francophone pour estimer et comparer la consommation électrique d’appareils domestiques et informatiques. HTML sémantique, CSS et JavaScript ES modules, sans dépendance d’exécution ni backend.

## Contenu

- Calculateur principal : consommation moyenne journalière, hebdomadaire, sur 30 jours et annuelle, coût aux mêmes périodes, graphique accessible, CSV, copie et partage par URL.
- Comparateur multi-appareils avec classement annuel, écart et économie théorique maximale si le service rendu est équivalent.
- Enregistrement local explicitement déclenché par l’utilisateur (20 simulations au maximum) ; thème clair/sombre mémorisé si le navigateur l’autorise.
- Neuf simulateurs dédiés et six guides éditoriaux.
- Pages Mentions légales, Confidentialité et Contact à relire et compléter avant lancement.
- Sitemap et robots.txt à personnaliser avec l’URL publique.
- AdSense et Microsoft Clarity sont configurés. Leurs scripts tiers ne se chargent qu’après les choix CMP requis. Aucune police externe n’est chargée.

## Hypothèses et calculs

Les heures sont les heures par jour **où l’appareil est utilisé** ; les jours sont le nombre de jours utilisés dans une semaine. L’usage est moyenné sur sept jours :

```text
kWh/jour moyen = puissance (W) × heures/jour actif × jours/semaine × quantité ÷ 7 ÷ 1 000
coût = énergie (kWh) × prix saisi (€/kWh)
semaine = moyenne journalière × 7
mois estimé = moyenne journalière × 30
année estimée = moyenne journalière × 365
```

Le calcul suppose une puissance constante pendant les heures saisies. Pour un équipement cyclique ou variable, entrez une puissance moyenne mesurée ou faites un calcul par état. Les valeurs d’exemple sont indicatives et modifiables ; elles ne sont ni des mesures universelles ni des tarifs recommandés. Le prix utilisé est celui saisi, sans estimation de taxes, abonnement ou variation tarifaire. Les valeurs ne sont arrondies que pour l’affichage.

## Tester localement

Un navigateur moderne suffit. Pour utiliser le site en local, servez le dépôt avec un serveur HTTP statique (les modules ES ne fonctionnent pas uniformément en ouvrant directement `file://`). Par exemple, avec Python déjà installé :

```powershell
python -m http.server 8000
```

Puis ouvrir `http://localhost:8000/`. Aucun paquet à installer.

Tests automatisés avec Node.js (sans dépendances à installer) :

```powershell
npm test
```

Les tests vérifient les conversions et validations principales, l’unicité des titres et H1, ainsi que l’existence des liens locaux et de leurs fragments.

## Publication sur GitHub Pages

1. Créez ou choisissez le dépôt GitHub destiné au site, puis poussez tout le contenu du dépôt dans la branche de publication (par exemple `main`). Ne placez pas le site dans un sous-dossier : `index.html` doit rester à la racine.
2. Ouvrez **Settings → Pages** du dépôt.
3. Dans **Build and deployment → Source**, sélectionnez **GitHub Actions**, puis enregistrez.
4. Poussez les changements sur `main`. Dans **Actions**, vérifiez que les jobs `build` et `deploy` réussissent. Testez ensuite l’adresse Pages sur ordinateur et mobile, ainsi que chaque simulateur.
5. Pour un dépôt projet, l’URL publique comprend le chemin du dépôt, par exemple `https://UTILISATEUR.github.io/NOM-DU-DEPOT/`. Pour un dépôt utilisateur ou un domaine personnalisé, elle est généralement à la racine du domaine.
6. La configuration initiale pointe vers `https://wattcombien.pages.dev`. Si vous publiez sous une autre adresse, remplacez `siteUrl` dans `js/config.js` par la **base publique sans slash final**. Pour un dépôt projet, conservez le chemin `/NOM-DU-DEPOT`. La balise canonical est générée sur chaque page à partir de cette base.
7. Si vous changez de domaine, mettez aussi à jour toutes les URLs de `sitemap.xml` et la directive `Sitemap:` de `robots.txt` avec cette même base. Vérifiez que chaque URL retourne bien la bonne page.

### Déploiement par workflow GitHub Actions

Le dépôt contient `.github/workflows/deploy.yml`. Il lance `npm test` sur `main`, assemble dans `_site` les seuls fichiers nécessaires au site, puis publie cet artefact statique. Aucun bundler ni commande `npm run build` n’est nécessaire.

Si un déploiement échoue, ouvrez **Actions → le workflow “Deploy static site to GitHub Pages” → l’exécution concernée → le job en échec → le détail de l’étape rouge**. Pour le diagnostic, relevez le lien de l’exécution, le nom du job, le message d’erreur complet et le SHA du commit. Vérifiez également **Settings → Pages** et que le workflow est autorisé à utiliser l’environnement `github-pages`.

### Domaine personnalisé et Cloudflare

1. Ajoutez le domaine personnalisé dans **Settings → Pages → Custom domain** sur GitHub, puis suivez la procédure de vérification de domaine proposée par GitHub. Utilisez un sous-domaine `www` ou un domaine apex comme domaine canonique et redirigez l’autre variante vers celui-ci.
2. Dans Cloudflare, choisissez le mode DNS **Full setup** et créez les enregistrements indiqués par la documentation GitHub Pages en vigueur pour le domaine apex et/ou le sous-domaine. Pour `www`, la cible est généralement `UTILISATEUR.github.io` (sans nom de dépôt) ; pour l’apex, configurez les adresses A/AAAA actuellement recommandées par GitHub. Ne devinez pas ces valeurs si GitHub en affiche d’autres.
3. Laissez temporairement le proxy Cloudflare désactivé (**DNS only**, nuage gris) pendant la validation du domaine et l’émission du certificat GitHub. Attendez la propagation DNS puis activez **Enforce HTTPS** dans les réglages Pages dès que l’option apparaît.
4. Confirmez que `https://votre-domaine/` fonctionne sans avertissement. Mettez alors `siteUrl`, le sitemap et le `Sitemap:` de `robots.txt` à jour avec la variante canonique HTTPS.
5. Le DNS seul ne fournit pas le cache proxy Cloudflare. Si vous activez ensuite le proxy Cloudflare (nuage orange) pour son cache, configurez le mode SSL/TLS **Full (strict)**, testez HTTPS et le renouvellement du certificat, puis établissez des règles de cache prudentes. Évitez de mettre en cache longtemps les documents HTML pendant les mises à jour ; les ressources versionnées peuvent être mises en cache plus longtemps. Revalidez toujours le certificat GitHub Pages après toute modification DNS/proxy.
6. Ajoutez à la racine un fichier `CNAME` contenant le domaine personnalisé exact si la procédure GitHub Pages le demande pour votre méthode de déploiement. Ne remplacez pas l’adresse publique canonique par l’URL temporaire si le domaine est actif.

Les règles et adresses IP de GitHub Pages peuvent évoluer : vérifiez la documentation officielle GitHub et Cloudflare au moment de la configuration.

### Cloudflare Pages

Le dépôt est un site statique sans compilation. Dans **Cloudflare Dashboard → Workers & Pages → Create application → Pages → Connect to Git**, sélectionnez le dépôt et la branche à publier. Choisissez un préréglage **None** ou équivalent, laissez la commande de build vide et définissez le répertoire de sortie sur la racine du dépôt (`.`). Après le premier déploiement, vérifiez `https://wattcombien.pages.dev/ads.txt` et une page de simulateur. Le workflow `.github/workflows/deploy.yml` est destiné à GitHub Pages et n’est pas requis pour le déploiement Cloudflare Pages.

## Google AdSense, Microsoft Clarity, Cloudflare Web Analytics et consentement

L’identifiant éditeur AdSense est configuré dans `js/config.js`, dans `ads.txt` et dans la balise `<meta name="google-adsense-account">` présente sur chaque page HTML pour la vérification de propriété. Cette balise ne charge pas les publicités. Chaque page charge le module local `js/adsense.js`, qui importe les chargeurs Clarity et Cloudflare Web Analytics. Les modules partagent l’écoute de l’API IAB TCF 2.2 et appliquent des finalités séparées. Le script AdSense reste configurable et ne se charge qu’après un signal autorisant les finalités TCF 1, 3 et 4 et le fournisseur Google. Clarity et Cloudflare Web Analytics se chargent uniquement après un choix valide autorisant les finalités 1 et 8. L’identifiant Clarity et le token Cloudflare sont configurés dans `js/config.js`. Aucun script tiers de ces services n’est ajouté directement au HTML.

Avant de mettre ces outils en service, configurez dans Cloudflare Pages une CMP compatible avec IAB TCF 2.2 et certifiée par Google pour les annonces là où cela est requis. Installez son script avant le chargeur local afin que `__tcfapi` soit disponible. La CMP doit offrir le choix des finalités de mesure et de publicité, ainsi que le retrait du consentement. Sans signal CMP valide, aucun script Clarity, Cloudflare Web Analytics ou AdSense n’est chargé.

Le module Clarity envoie également l’API `consentv2` de Microsoft avec les états `analytics_Storage` et `ad_Storage`. Le stockage analytique reflète le choix TCF 1 et 8. Le stockage publicitaire Microsoft reste refusé, car la CMP configurée pour AdSense ne représente pas nécessairement un consentement à Microsoft Advertising. En cas de retrait du consentement analytique après chargement de Clarity, le nouvel état refusé est transmis. Microsoft précise qu’en mode sans consentement, Clarity peut collecter des données sans cookies avec des fonctionnalités limitées. Si cette collecte n’est pas souhaitée après retrait, configurez et vérifiez le mode de consentement et les réglages du projet Clarity avant publication.

Dans le projet Clarity, activez **Settings → Setup → Consent Mode**. Vérifiez le masquage des champs et contenus sensibles, les données collectées et les durées de conservation. Testez un refus, une acceptation, puis un retrait du choix. Une CMP fonctionnelle n’est actuellement pas incluse dans le dépôt. Consultez la [documentation Microsoft sur Consent Mode](https://learn.microsoft.com/en-us/clarity/setup-and-installation/consent-mode) et l’[API Consent V2](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2). La présence des scripts ne garantit pas l’approbation AdSense ni la conformité juridique de la configuration.

### Cloudflare Web Analytics

Le token `f53bdf1fc5cd4b86925ed77fcefbf8a3` est configuré dans `js/config.js`. Le chargeur crée une seule balise module après consentement TCF valide. La page publique `https://wattcombien.pages.dev/` ne contenait pas de beacon Cloudflare lors de la vérification du 10 novembre 2026. Le réglage du tableau de bord Cloudflare Pages n’est pas versionné dans ce dépôt et doit être vérifié après déploiement.

Pour éviter une injection automatique qui contournerait le choix CMP et ferait doublon, ouvrez **Cloudflare Dashboard → Workers & Pages → WattCombien → Metrics → Web Analytics** et laissez l’injection automatique désactivée. N’activez pas en parallèle la configuration automatique one-click de Web Analytics. Après déploiement, accordez le consentement analytique dans la CMP puis vérifiez dans les outils réseau du navigateur que `beacon.min.js` est chargé une seule fois et que le token transmis correspond à celui configuré. Un refus ne doit déclencher aucune requête au beacon.

Pour voir les premières données, ouvrez **Cloudflare Dashboard → Web Analytics**, choisissez le site associé au hostname (`wattcombien.pages.dev`), puis consultez ses métriques. Cloudflare indique que les données peuvent prendre quelques minutes à apparaître. Les bloqueurs de publicité et de suivi peuvent empêcher le beacon côté navigateur. La réception réelle des données doit être confirmée dans le tableau de bord après le déploiement.

## Search Console et sitemap

1. Vérifiez la propriété de domaine ou l’URL préfixe dans Google Search Console en suivant l’option de vérification proposée.
2. Une fois le site publié et ses URLs publiques vérifiées, soumettez `https://VOTRE-DOMAINE/sitemap.xml` (ou l’URL complète incluant le chemin GitHub Pages) dans la section **Sitemaps**.
3. Vérifiez `robots.txt`, les canoniques, l’accès HTTPS et les pages importantes avec l’inspection d’URL. Un sitemap facilite la découverte, mais ne garantit ni indexation ni classement.

## Configuration légale et confidentialité

- L’adresse publique de contact et d’exercice des droits est `speedoutv.pro@gmail.com`. Les pages juridiques présentent WattCombien comme nom public et indiquent que le statut non professionnel n’est pas juridiquement confirmé.
- `wattcombien.pages.dev` et sa Pages Function sont servis par Cloudflare Pages. Le workflow du dépôt publie aussi une version distincte via GitHub Pages à `speedcrafttv.github.io/WattCombien`; les mentions légales identifient le prestataire correspondant à chaque URL.
- L’exception d’anonymat de l’article 6, III, 2 de la LCEN ne peut être retenue qu’après vérification du statut non professionnel au vu de l’activité réelle, y compris le projet de monétisation, et après communication confidentielle des informations personnelles requises à l’hébergeur. Les mentions publiques ne remplacent pas cette démarche. L’identité requise du responsable au titre de l’article 13 du RGPD reste à vérifier avant toute collecte de données personnelles.
- Le formulaire reste désactivé, sa base juridique et sa durée de conservation n’étant pas définies. Aucun bandeau ou CMP n’est fourni dans le dépôt. Les modules AdSense, Clarity et Cloudflare Analytics attendent un signal CMP, mais toute injection automatique Cloudflare doit aussi être vérifiée dans le tableau de bord avant activation.

## Formulaire de contact, Supabase et Cloudflare Pages Functions

Le formulaire de `pages/contact.html` est désactivé par défaut. Il ne transmet aucune donnée tant que les services, les informations de confidentialité et la configuration frontale ne sont pas complétés. Son unique endpoint est `functions/api/contact.js`, servi par Cloudflare Pages à `/api/contact`. Il n’envoie pas de courriel de notification : les demandes reçues seront consultables dans la table Supabase par un administrateur autorisé. GitHub Pages ne prend pas en charge les Cloudflare Pages Functions.

### 1. Créer et sécuriser la table Supabase

1. Créez un projet Supabase et ouvrez **SQL Editor → New query**.
2. Exécutez le fichier `supabase/migrations/20261110000000_create_contact_messages.sql`.
3. Vérifiez dans **Table Editor** que `contact_messages` a RLS activé et qu’aucune politique n’accorde de lecture ou d’écriture aux rôles `anon` ou `authenticated`. La migration retire leurs privilèges SQL et n’accorde à `service_role` que l’insertion. Les administrateurs peuvent consulter les messages dans le tableau de bord Supabase.
4. Copiez l’URL de base du projet, par exemple `https://PROJECT_REF.supabase.co`, sans ajouter `/rest/v1`. Créez ou récupérez une clé `secret` Supabase et gardez-la uniquement dans les secrets Cloudflare Pages. Ne la placez jamais dans `js/config.js`, dans une page HTML ou dans une variable publique.

### 2. Créer le widget Turnstile

Dans **Cloudflare Dashboard → Turnstile → Add widget**, créez un widget géré et autorisez les domaines réellement utilisés, notamment `wattcombien.pages.dev` et, si nécessaire, `speedcrafttv.github.io` ou votre domaine personnalisé. La Site Key `0x4AAAAAAF7Td1S4Wd6MOzt-` est intégrée à la configuration publique. La clé secrète doit être enregistrée dans les secrets du projet Cloudflare Pages, sous le nom exact `TURNSTILE_SECRET`. La Function vérifie chaque jeton auprès de l’API Siteverify, ainsi que le hostname et l’action `contact`. La vérification côté navigateur seule ne constitue pas une protection.

### 3. Déployer la Pages Function

La Function est dans `functions/api/contact.js`; Cloudflare Pages mappe ce chemin vers `/api/contact`. Le projet doit être publié par l’intégration Git Cloudflare Pages ou par un déploiement Pages qui inclut le dossier `functions`. Le workflow GitHub Pages de ce dépôt ne déploie pas cette API.

Dans **Cloudflare Dashboard → Workers & Pages → WattCombien → Settings → Variables and Secrets**, ajoutez ces variables pour les environnements Production et Preview selon le besoin :

| Nom | Type | Valeur |
| --- | --- | --- |
| `CONTACT_ENABLED` | Variable | `false` pendant la configuration, `true` uniquement après les essais |
| `SUPABASE_URL` | Variable | URL de base HTTPS du projet, sans `/rest/v1` |
| `TURNSTILE_EXPECTED_HOSTNAMES` | Variable | Hostnames exacts autorisés, séparés par des virgules |
| `ALLOWED_ORIGINS` | Variable | Origines HTTPS exactes autorisées, séparées par des virgules |
| `TURNSTILE_SECRET` | Secret | Secret Turnstile, jamais dans le dépôt |
| `SUPABASE_SECRET_KEY` | Secret | Clé secrète Supabase, jamais dans le dépôt |

4. Dans les réglages de build du projet Pages, utilisez la racine du dépôt comme répertoire de sortie (`.`), une commande de build vide et une version du système de build qui prend en charge les Functions. Si le projet utilise une autre méthode de déploiement, assurez-vous que le dossier `functions` est inclus à la racine du répertoire publié.

5. Pour limiter les abus, créez dans Cloudflare une règle WAF de limitation de débit ciblant `POST /api/contact`, par exemple cinq requêtes par minute par adresse IP. La disponibilité des règles dépend du plan Cloudflare. La Function respecte aussi une liaison `CONTACT_LIMITER` si vous en configurez une dans le projet.

6. Déclenchez un nouveau déploiement Pages après l’ajout des variables et secrets afin qu’ils soient disponibles à la Function.

### 4. Activer le formulaire après les tests

Dans `js/config.js`, `contact.turnstileSiteKey` contient déjà la Site Key fournie et `contact.apiUrl` vaut `/api/contact`. Pour le domaine Cloudflare Pages, conservez cette URL relative. Si le site est également servi sur GitHub Pages, configurez pour cette version une URL HTTPS complète pointant vers `https://wattcombien.pages.dev/api/contact`, et ajoutez `https://speedcrafttv.github.io` à `ALLOWED_ORIGINS`. Renseignez également `legal.contactRetentionDays`, `legal.contactLegalBasis`, `legal.privacyEmail` et les informations éditeur. Le formulaire ne s’active que lorsque les champs exigés sont renseignés et que `contact.enabled` passe à `true`.

`SUPABASE_URL` doit rester une URL de base comme `https://PROJECT_REF.supabase.co`; la Function ajoute elle-même `/rest/v1/contact_messages` une seule fois. La clé `SUPABASE_SECRET_KEY` est envoyée au Data API uniquement par la Function. N’activez pas la Function tant que vous n’avez pas vérifié que cette clé a les droits nécessaires pour insérer dans la table et qu’aucun rôle public ne peut lire les messages.

Configurez une tâche de suppression périodique dans Supabase selon la durée publiée, par exemple :

```sql
delete from public.contact_messages
where received_at < now() - make_interval(days => 90);
```

Remplacez `90` par la durée que vous aurez réellement choisie et publiée. Cette requête d’exemple n’est pas planifiée automatiquement par la migration. Définissez aussi qui peut accéder aux messages et comment les demandes d’effacement seront traitées. La Function ne stocke pas l’adresse IP dans la table et ne la transmet pas à Turnstile.

Le contact optionnel sert uniquement à répondre. Sans système de notification configuré, l’éditeur doit consulter la table Supabase pour traiter les demandes. Le formulaire ne doit pas être présenté comme opérationnel tant que chaque étape n’est pas achevée.

### Informations à fournir avant la mise en service

- Nom légal ou raison sociale de l’éditeur, forme juridique, adresse professionnelle et numéro d’immatriculation applicable.
- Nom du directeur ou de la directrice de publication.
- Adresse de contact générale et adresse dédiée aux demandes relatives aux données personnelles.
- Base juridique retenue pour le traitement des demandes et durée de conservation effective.
- Entité Cloudflare contractante et adresse de notification correspondant au compte utilisé.
- Domaines publics qui hébergent le site et domaines Turnstile autorisés.
- Responsable des accès Supabase, procédure de traitement des demandes et calendrier de suppression des messages.

## AdSense

La configuration centrale est dans `js/config.js`. L’identifiant `ca-pub-5689496403962976` et la ligne `ads.txt` ont été ajoutés comme fournis. Le module partagé retarde l’insertion du script Google jusqu’au signal CMP décrit ci-dessus. Il n’y a pas de blocs publicitaires manuels ni de garantie d’acceptation par Google.

## Arborescence

```text
index.html
pages/
  simulateurs/  (index + 9 calculateurs)
  guides/       (6 guides)
  mentions-legales.html
  confidentialite.html
  contact.html
css/styles.css
js/             (calculs, interface, SEO, configuration, simulateurs)
                (chargeurs AdSense, Clarity et Cloudflare soumis au consentement CMP)
functions/      (API de contact Cloudflare Pages Functions, désactivée par défaut)
supabase/       (migration SQL de la table privée des messages)
assets/favicon.svg
tests/          (tests Node intégrés, sans dépendances)
package.json    (type de modules et commande npm test)
robots.txt
sitemap.xml
ads.txt
```
