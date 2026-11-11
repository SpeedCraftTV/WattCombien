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
- `wattcombien.pages.dev` et sa passerelle Pages sont servis par Cloudflare Pages. Le workflow du dépôt publie aussi une version distincte via GitHub Pages à `speedcrafttv.github.io/WattCombien`; les mentions légales identifient le prestataire correspondant à chaque URL.
- L’exception d’anonymat de l’article 6, III, 2 de la LCEN ne peut être retenue qu’après vérification du statut non professionnel au vu de l’activité réelle, y compris le projet de monétisation, et après communication confidentielle des informations personnelles requises à l’hébergeur. Les mentions publiques ne remplacent pas cette démarche. L’identité requise du responsable au titre de l’article 13 du RGPD reste à vérifier avant toute collecte de données personnelles.
- Le formulaire reste désactivé. Une durée maximale provisoire de 365 jours et des bases juridiques proposées sont préparées dans `js/config.js`, mais attendent l’approbation de l’éditeur. Le formulaire exige aussi `contact.legalSettingsApproved: true`. Aucun bandeau ou CMP n’est fourni dans le dépôt. Les modules AdSense, Clarity et Cloudflare Analytics attendent un signal CMP, mais toute injection automatique Cloudflare doit aussi être vérifiée dans le tableau de bord avant activation.

## Formulaire de contact, Supabase et Worker Cloudflare privé

Le formulaire de `pages/contact.html` est désactivé par défaut. L’endpoint same-origin `/api/contact` est une passerelle Pages (`functions/api/contact.js`) qui transmet exclusivement au Worker privé `workers/contact-api/src/index.js` par le Service Binding `CONTACT_API`. Le Worker applique le limiteur, vérifie Turnstile et seul lui peut insérer dans Supabase. Il n’existe aucun fallback vers une insertion depuis Pages. GitHub Pages ne prend pas en charge les Cloudflare Pages Functions.

### 1. Créer et sécuriser la table Supabase

1. Vérifiez d’abord l’état actuel de `public.contact_messages` avec les requêtes en lecture seule de `supabase/verification/contact_messages_readonly_checks.sql`. Faites une sauvegarde adaptée avant toute modification.
2. Pour une base où la table existe déjà avec les statuts localisés signalés, ouvrez **Supabase Dashboard → SQL Editor → New query**, examinez puis exécutez manuellement uniquement `supabase/migrations/20261111001000_reconcile_contact_messages_schema.sql`. Elle est transactionnelle et s'arrête sur les colonnes inattendues, des données invalides, un déclencheur actif, une contrainte réutilisée sous une définition différente ou des privilèges effectifs résiduels. Elle ne retire que les contraintes CHECK dont l'expression correspond exactement à l'ancienne liste française de statuts; toutes les autres contraintes sont préservées. Elle convertit les statuts français vers `new`, `in_progress`, `closed`, ajoute les contraintes manquantes, rétablit les valeurs par défaut et limite les privilèges effectifs de `service_role` à INSERT. PostgreSQL 17 et versions ultérieures vérifient également explicitement le privilège `MAINTAIN`; les versions antérieures n'ont pas ce privilège. Les longueurs des champs texte comptent les points de code Unicode, comme `char_length` dans PostgreSQL. La base contrôle le caractère facultatif et la longueur de l’e-mail; son format reste validé par le Worker. Ne réexécutez pas les migrations historiques simplement parce que `schema_migrations` est absent.
3. La migration historique `20261110000000_create_contact_messages.sql` puis le renommage `20261110220000_rename_contact_received_at_to_created_at.sql` restent inchangés. Ils ne constituent pas une preuve d’exécution historique et ne doivent pas être rejoués aveuglément sur une table déjà existante.
4. Après l’exécution manuelle, relancez les requêtes de `supabase/verification/contact_messages_readonly_checks.sql`. Attendez-vous à RLS activé, aucune politique, absence de privilèges effectifs pour `anon` et `authenticated`, et INSERT uniquement pour `service_role` (y compris absence de `MAINTAIN` sur PostgreSQL 17 et ultérieur). Vérifiez le propriétaire, les privilèges effectifs, les rôles hérités et les déclencheurs. `service_role` peut posséder l'attribut Supabase `BYPASSRLS`; cela ne remplace pas les privilèges SQL de la table. La migration n'accepte pas qu'un rôle API puisse assumer le rôle propriétaire et s'annule si les privilèges effectifs après révocation ne correspondent pas à ces attentes.
5. Copiez l’URL de base du projet, par exemple `https://PROJECT_REF.supabase.co`, sans ajouter `/rest/v1`. La clé secrète Supabase ne doit être configurée que comme secret du Worker Preview, jamais dans les secrets Pages, `js/config.js`, une page HTML ou une variable publique.

### 2. Créer le widget Turnstile

Dans **Cloudflare Dashboard → Turnstile → Add widget**, créez ou sélectionnez un widget géré et autorisez explicitement `test-contact.wattcombien.pages.dev`. La Site Key `0x4AAAAAAF7Td1S4Wd6MOzt-` est intégrée à la configuration publique. Le secret doit être enregistré uniquement dans les secrets du Worker Preview, sous le nom exact `TURNSTILE_SECRET`. Le Worker vérifie chaque jeton auprès de l’API Siteverify, ainsi que le hostname exact et l’action `contact`; la vérification côté navigateur seule ne constitue pas une protection.

### 3. Préparer le Worker et les liaisons Preview

Ne configurez que l’environnement Preview associé à `test-contact`; ne modifiez aucun réglage Production. La configuration versionnée du Worker est `workers/contact-api/wrangler.jsonc`. Elle désactive `workers.dev` et configure `CONTACT_LIMITER` à cinq requêtes par période de 60 secondes. Avant le premier déploiement manuel, vérifiez que son `namespace_id` est unique dans votre compte Cloudflare. Le binding de limitation de débit se déclare dans Wrangler; créer un Worker script depuis le tableau de bord seul ne suffit pas à lui fournir ce binding. Aucun Worker n’est déployé par ces changements.

1. Déployez la branche `test-contact` en Preview et vérifiez l’URL d’alias `https://test-contact.wattcombien.pages.dev`.
2. Dans **Workers & Pages → Create application → Create Worker**, créez le service `wattcombien-contact-preview` si nécessaire. Le code est dans `workers/contact-api/src/index.js`; le tableau de bord seul ne déclare pas le binding de limite de débit. Après autorisation explicite du déploiement, appliquez depuis la racine du dépôt la configuration Wrangler :

   ```sh
   npx wrangler deploy --config workers/contact-api/wrangler.jsonc
   ```

   Cela configure `CONTACT_LIMITER` et garde `workers.dev` désactivé. N’ajoutez aucune route publique au Worker.
3. Dans **Workers & Pages → WattCombien → Settings → Functions → Service bindings**, ajoutez uniquement en Preview un binding nommé `CONTACT_API` pointant vers `wattcombien-contact-preview`. Vérifiez que le contexte affiché est bien Preview avant d’enregistrer. Si l’interface ne permet pas de confirmer la portée Preview, arrêtez-vous et ne modifiez pas la configuration.
4. Générez localement un secret aléatoire d’au moins 32 caractères. Ajoutez la même valeur comme secret `CONTACT_GATEWAY_TOKEN` dans les Variables and Secrets Preview de Pages et dans celles du Worker. Ne la mettez jamais dans le dépôt, une variable publique ou les journaux. Le Worker refuse les appels qui n’ont pas ce secret et la passerelle remplace les en-têtes du client par l’adresse `CF-Connecting-IP` reçue de Cloudflare.

Configurez les valeurs suivantes dans les réglages du Worker `wattcombien-contact-preview`. Les secrets Supabase et Turnstile sont inutiles pour le test désactivé décrit ci-dessous; ne les ajoutez qu’à ce Worker, jamais à Pages. Pour le test désactivé, `CONTACT_GATEWAY_TOKEN` est le seul secret nécessaire.

| Nom | Type | Valeur Preview |
| --- | --- | --- |
| `CONTACT_ENABLED` | Variable | `false` |
| `ALLOWED_ORIGINS` | Variable | `https://test-contact.wattcombien.pages.dev` |
| `TURNSTILE_EXPECTED_HOSTNAMES` | Variable | `test-contact.wattcombien.pages.dev` |
| `SUPABASE_URL` | Variable | URL HTTPS du projet de test Supabase |
| `CONTACT_GATEWAY_TOKEN` | Secret | Même valeur aléatoire dans Worker et Pages Preview |
| `TURNSTILE_SECRET` | Secret | Secret du widget autorisant le hostname Preview |
| `SUPABASE_SECRET_KEY` | Secret | Clé du projet Supabase de test |

Dans les réglages Pages Preview, configurez le secret `CONTACT_GATEWAY_TOKEN` et le binding `CONTACT_API`; n’y copiez pas les secrets Turnstile ou Supabase. Le frontend reste désactivé tant que `contact.enabled` et `contact.legalSettingsApproved` sont `false` dans `js/config.js`. Le Worker vérifie le limiteur avant `CONTACT_ENABLED`; lorsque celui-ci vaut `false`, il répond `503` sans analyser le corps et sans appeler Turnstile ni Supabase.

### 4. Tester le limiteur sans envoyer de message

1. Lancez `npm test` localement pour tester le Worker et la passerelle sans contacter de service externe.
2. Après configuration manuelle et déploiement explicite des deux services, ouvrez la Preview authentifiée par Cloudflare Access. Dans la console du navigateur sur cette origine, envoyez six requêtes sans donnée personnelle :

   ```js
   const statuses = [];
   for (let i = 0; i < 6; i++) {
     const response = await fetch("/api/contact", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: "{}"
     });
     statuses.push(response.status);
   }
   console.log(statuses);
   ```

   Avec un compteur frais et les six appels dans la même période de 60 secondes, les cinq premiers doivent répondre `503` (collecte désactivée) et le suivant `429` (limite dépassée). Le limiteur Cloudflare est approximatif et local au point de présence; attendez plus de 60 secondes avant un nouvel essai. Aucun appel Turnstile/Supabase ni aucune insertion ne doit avoir lieu. Si le résultat diffère, arrêtez et vérifiez le binding, l’adresse IP transmise, le secret interne et les journaux sans y publier de secrets.

### 5. Activation ultérieure (non effectuée par cette préparation)

Cette préparation ne modifie ni `js/config.js`, ni `CONTACT_ENABLED=false`, ni les réglages Cloudflare. L’activation nécessiterait ultérieurement une validation technique et juridique distincte, puis des changements Preview explicitement approuvés. Ne réutilisez pas les secrets d’un projet Supabase de production pour un test.

Dans `js/config.js`, `contact.turnstileSiteKey` contient déjà la Site Key fournie et `contact.apiUrl` vaut `/api/contact`; cette URL relative reste adaptée à Pages. Les champs `legal.contactRetentionDays: 365` et `legal.contactLegalBasis` sont des propositions, pas des choix validés. Le formulaire ne doit être activé qu’après validation des bases juridiques, durées, politique de confidentialité et informations obligatoires du responsable, et approbation explicite distincte.

`SUPABASE_URL` peut être l’URL de base comme `https://PROJECT_REF.supabase.co`, ou la même URL terminant par `/rest/v1`. Le Worker accepte les deux formats et construit `/rest/v1/contact_messages` une seule fois. La clé secrète Supabase récente est envoyée dans l’en-tête `apikey` côté serveur. Pour une ancienne clé JWT `service_role`, le Worker ajoute aussi l’en-tête `Authorization: Bearer`. La migration corrective ne donne que le privilège direct `INSERT` à `service_role`, mais ce rôle reste privilégié et doit demeurer exclusivement côté serveur. Vérifiez ses privilèges effectifs, son propriétaire et ses appartenances avant tout test. La date `created_at` est définie par défaut en base, le code ne la fournit pas dans l’insertion.

La migration ne crée pas ni ne consulte `supabase_migrations.schema_migrations`. L’absence de ce registre ne prouve pas l’absence d’exécution antérieure. Ne considérez la correction appliquée qu’après avoir exécuté manuellement la migration et vérifié ses effets avec les requêtes SQL en lecture seule fournies.

Configurez une tâche de suppression périodique dans Supabase selon la durée publiée, par exemple :

```sql
delete from public.contact_messages
where created_at < now() - make_interval(days => 365);
```

Cette durée de 365 jours est une proposition à approuver, pas une obligation légale. Cette requête d’exemple n’est pas planifiée automatiquement par la migration. Prévoir aussi une suppression plus tôt des demandes closes lorsque leur conservation n’est plus nécessaire, et définir le traitement des demandes liées aux droits. Définissez qui peut accéder aux messages et comment les demandes d’effacement seront traitées. La Function ne stocke pas l’adresse IP dans la table et ne la transmet pas à Turnstile.

Le contact optionnel sert uniquement à répondre. Sans système de notification configuré, l’éditeur doit consulter la table Supabase pour traiter les demandes. Le formulaire ne doit pas être présenté comme opérationnel tant que chaque étape n’est pas achevée.

### Informations à fournir avant la mise en service

- Nom légal ou raison sociale de l’éditeur, forme juridique, adresse professionnelle et numéro d’immatriculation applicable.
- Nom du directeur ou de la directrice de publication.
- Adresse de contact générale et adresse dédiée aux demandes relatives aux données personnelles.
- Validation des bases juridiques proposées, de la durée maximale de 365 jours et des modalités de suppression effective.
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
functions/      (passerelle Pages vers le Worker de contact privé)
workers/        (API privée de contact et configuration Wrangler)
supabase/       (migration SQL de la table privée des messages)
assets/favicon.svg
tests/          (tests Node intégrés, sans dépendances)
package.json    (type de modules et commande npm test)
robots.txt
sitemap.xml
ads.txt
```
