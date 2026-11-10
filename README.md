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

- Renseignez les variables `legal` de `js/config.js` avec l’identité réelle de l’éditeur, son adresse, les immatriculations applicables, le directeur de publication et les contacts pour les demandes générales et la vie privée.
- Le dépôt publie le site via GitHub Pages depuis `main`, et l’adresse `wattcombien.pages.dev` est servie par Cloudflare Pages. Les mentions légales nomment les deux prestataires, car le fournisseur dépend de l’URL effectivement visitée. Si une URL n’est plus publiée, retirez le prestataire correspondant après vérification.
- La politique de confidentialité couvre les calculs locaux, le stockage volontaire, les outils d’analyse et le futur formulaire. Sa base juridique et sa durée de conservation sont à renseigner avant d’activer ce dernier.
- Aucun faux bandeau ni CMP fictive n’est fourni. Clarity, Cloudflare Web Analytics et AdSense restent inactifs tant qu’une CMP compatible n’est pas configurée et qu’un signal de consentement approprié n’est pas reçu.

## Formulaire de contact, Supabase et Cloudflare Worker

Le formulaire de `pages/contact.html` est désactivé par défaut. Il ne transmet aucune donnée tant que les services, les informations de confidentialité et la configuration frontale ne sont pas complétés. Il n’envoie pas de courriel de notification : les demandes reçues seront consultables dans la table Supabase par un administrateur autorisé.

### 1. Créer et sécuriser la table Supabase

1. Créez un projet Supabase et ouvrez **SQL Editor → New query**.
2. Exécutez le fichier `supabase/migrations/20261110000000_create_contact_messages.sql`.
3. Vérifiez dans **Table Editor** que `contact_messages` a RLS activé et qu’aucune politique n’accorde de lecture ou d’écriture aux rôles `anon` ou `authenticated`. La migration retire leurs privilèges SQL et n’accorde à `service_role` que l’insertion. Les administrateurs peuvent consulter les messages dans le tableau de bord Supabase.
4. Copiez l’URL du projet. Gardez la clé `service_role` uniquement comme secret côté Worker. Ne la placez jamais dans `js/config.js`, dans une page HTML ou dans une variable publique Cloudflare.

### 2. Créer le widget Turnstile

Dans **Cloudflare Dashboard → Turnstile → Add widget**, créez un widget géré et autorisez les domaines réellement utilisés, par exemple `wattcombien.pages.dev` et votre domaine personnalisé. Le `site key` est public et sera configuré dans le navigateur. La `secret key` reste exclusivement dans les secrets du Worker. Le Worker vérifie chaque jeton auprès de l’API Siteverify, ainsi que le hostname et l’action `contact`. La vérification côté navigateur seule n’est pas considérée comme une protection.

### 3. Déployer le Worker

Le manifeste est `worker/wrangler.toml` et le point d’entrée est `worker/src/index.js`. Le Worker n’accepte que les origines exactement listées, limite les requêtes à 5 par minute et par adresse source via la liaison Cloudflare de limitation de débit, valide les champs et le CAPTCHA, puis effectue une insertion sans lecture de la base. La limitation Cloudflare est approximative et peut s’appliquer séparément dans chaque point de présence.

1. Remplacez `PROJECT_REF` dans `worker/wrangler.toml` par la référence Supabase réelle. Adaptez `ALLOWED_ORIGINS` à toutes les origines exactes du site, sans caractère générique, et `TURNSTILE_EXPECTED_HOSTNAMES` à tous les hostnames autorisés par le widget. Pour le domaine GitHub Pages de ce dépôt, l’origine est `https://speedcrafttv.github.io` et le hostname Turnstile `speedcrafttv.github.io`. Modifiez le `namespace_id` de la liaison de limitation s’il est déjà utilisé dans votre compte Cloudflare.
2. Depuis la racine du dépôt, définissez les secrets sans les inscrire dans Git :

   ```powershell
   npx wrangler secret put TURNSTILE_SECRET_KEY --config worker/wrangler.toml
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config worker/wrangler.toml
   ```

3. Définissez `CONTACT_ENABLED` à `false` pendant la configuration. Déployez le Worker :

   ```powershell
   npx wrangler deploy --config worker/wrangler.toml
   ```

4. Testez le refus des origines inconnues, des CAPTCHA invalides, des messages incorrects et des requêtes trop fréquentes. Confirmez qu’un visiteur anonyme ne peut ni lire la table ni y écrire directement.

### 4. Activer le formulaire après les tests

Dans `js/config.js`, renseignez `contact.workerUrl` avec l’URL HTTPS complète terminant par `/api/contact`, `contact.turnstileSiteKey` avec le site key, puis activez `contact.enabled`. Renseignez également `legal.contactRetentionDays`, `legal.contactLegalBasis`, `legal.privacyEmail`, les champs éditeur, et mettez à jour les mentions légales et la politique. Ces champs manquants empêchent volontairement l’activation du formulaire.

Dans les variables du Worker, renseignez `TURNSTILE_EXPECTED_HOSTNAMES` et `ALLOWED_ORIGINS` avec les hostnames et origines exacts. Quand les tests de bout en bout et les informations légales sont finalisés, passez `CONTACT_ENABLED` à `true` dans `worker/wrangler.toml` et redéployez le Worker. Configurez une tâche de suppression périodique dans Supabase selon la durée publiée, par exemple :

```sql
delete from public.contact_messages
where received_at < now() - make_interval(days => 90);
```

Remplacez `90` par la durée que vous aurez réellement choisie et publiée. Cette requête d’exemple n’est pas planifiée automatiquement par la migration. Définissez aussi qui peut accéder aux messages et comment les demandes d’effacement seront traitées. Le Worker ne stocke pas l’adresse IP dans la table; il l’utilise comme clé de limitation de débit Cloudflare et ne la transmet pas à Turnstile.

Le contact optionnel sert uniquement à répondre. Sans système de notification configuré, l’éditeur doit consulter la table Supabase pour traiter les demandes. Le formulaire ne doit pas être présenté comme opérationnel tant que chaque étape n’est pas achevée.

### Informations à fournir avant la mise en service

- Nom légal ou raison sociale de l’éditeur, forme juridique, adresse professionnelle et numéro d’immatriculation applicable.
- Nom du directeur ou de la directrice de publication.
- Adresse de contact générale et adresse dédiée aux demandes relatives aux données personnelles.
- Base juridique retenue pour le traitement des demandes et durée de conservation effective.
- Entité Cloudflare contractante et adresse de notification correspondant au compte utilisé.
- Domaines publics qui hébergent le site, domaines Turnstile autorisés et URL du Worker déployé.
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
worker/         (API de contact Cloudflare Workers, désactivée par défaut)
supabase/       (migration SQL de la table privée des messages)
assets/favicon.svg
tests/          (tests Node intégrés, sans dépendances)
package.json    (type de modules et commande npm test)
robots.txt
sitemap.xml
ads.txt
```
