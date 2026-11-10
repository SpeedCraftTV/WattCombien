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

## Google AdSense, Microsoft Clarity et consentement

L’identifiant éditeur AdSense est configuré dans `js/config.js` et `ads.txt`. Chaque page charge le module local `js/adsense.js`, qui importe aussi le chargeur Clarity. Les deux modules partagent l’écoute de l’API IAB TCF 2.2 et appliquent des finalités séparées. AdSense se charge après un signal autorisant les finalités TCF 1, 3 et 4 et le fournisseur Google. Clarity se charge uniquement après un signal autorisant les finalités 1 et 8. Son identifiant `zbctlkmftd` est défini dans `js/config.js`. Aucun script tiers n’est ajouté statiquement aux pages.

Avant de mettre ces outils en service, configurez dans Cloudflare Pages une CMP compatible avec IAB TCF 2.2 et certifiée par Google pour les annonces là où cela est requis. Installez son script avant le chargeur local afin que `__tcfapi` soit disponible. La CMP doit offrir le choix des finalités de mesure et de publicité, ainsi que le retrait du consentement. Sans signal CMP valide, aucun script Clarity ou AdSense n’est chargé.

Le module Clarity envoie également l’API `consentv2` de Microsoft avec les états `analytics_Storage` et `ad_Storage`. Le stockage analytique reflète le choix TCF 1 et 8. Le stockage publicitaire Microsoft reste refusé, car la CMP configurée pour AdSense ne représente pas nécessairement un consentement à Microsoft Advertising. En cas de retrait du consentement analytique après chargement de Clarity, le nouvel état refusé est transmis. Microsoft précise qu’en mode sans consentement, Clarity peut collecter des données sans cookies avec des fonctionnalités limitées. Si cette collecte n’est pas souhaitée après retrait, configurez et vérifiez le mode de consentement et les réglages du projet Clarity avant publication.

Dans le projet Clarity, activez **Settings → Setup → Consent Mode**. Vérifiez le masquage des champs et contenus sensibles, les données collectées et les durées de conservation. Testez un refus, une acceptation, puis un retrait du choix. Une CMP fonctionnelle n’est actuellement pas incluse dans le dépôt. Consultez la [documentation Microsoft sur Consent Mode](https://learn.microsoft.com/en-us/clarity/setup-and-installation/consent-mode) et l’[API Consent V2](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2). La présence des scripts ne garantit pas l’approbation AdSense ni la conformité juridique de la configuration.

## Search Console et sitemap

1. Vérifiez la propriété de domaine ou l’URL préfixe dans Google Search Console en suivant l’option de vérification proposée.
2. Une fois le site publié et ses URLs publiques vérifiées, soumettez `https://VOTRE-DOMAINE/sitemap.xml` (ou l’URL complète incluant le chemin GitHub Pages) dans la section **Sitemaps**.
3. Vérifiez `robots.txt`, les canoniques, l’accès HTTPS et les pages importantes avec l’inspection d’URL. Un sitemap facilite la découverte, mais ne garantit ni indexation ni classement.

## Configuration légale et confidentialité

- Complétez les champs entre crochets de `pages/mentions-legales.html` avec les informations réelles de l’éditeur et vérifiez les obligations applicables avant publication.
- La page Contact pointe vers les issues du dépôt GitHub. Vérifiez que ce dépôt est public et les issues activées, ou remplacez le lien par un canal de contact réel. Ne publiez pas une adresse inventée.
- La politique de confidentialité décrit les calculs locaux, l’enregistrement volontaire, le partage par URL, Clarity et le chargement des scripts conditionné par la CMP.
- Aucun faux bandeau ni CMP fictive n’est fourni. Clarity et AdSense restent inactifs tant qu’une CMP compatible n’est pas configurée et qu’un signal de consentement approprié n’est pas reçu.

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
                (chargeurs AdSense et Clarity soumis au consentement CMP)
assets/favicon.svg
tests/          (tests Node intégrés, sans dépendances)
package.json    (type de modules et commande npm test)
robots.txt
sitemap.xml
ads.txt
```
