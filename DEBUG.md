# 🔍 Guide de Débogage

## Problèmes Courants et Solutions

### 1. Aucune fonctionnalité ne fonctionne

**Vérifications à faire :**

1. **Ouvrir la console du navigateur** (F12)
2. **Vérifier les erreurs JavaScript** dans la console
3. **Vérifier que le serveur est bien démarré** : `ng serve`

### 2. Les clics sur le PDF ne fonctionnent pas

**Causes possibles :**
- Le PDF n'est pas chargé (`pdfUrl` est vide)
- L'outil n'est pas sélectionné (`activeTool` est null)
- Erreur dans le calcul des coordonnées

**Solution :**
- Vérifier dans la console les logs : "Clic sur canvas", "Outil sélectionné"
- S'assurer qu'un outil est sélectionné avant de cliquer

### 3. Les champs ne s'affichent pas

**Causes possibles :**
- Les champs ne sont pas dans le bon format
- Erreur lors de l'ajout du champ
- Problème de rendu du PDF

**Solution :**
- Vérifier les logs : "Champ ajouté", "Total champs"
- Vérifier que `currentDocument.fields` contient bien les champs

### 4. Le PDF vierge ne se crée pas

**Causes possibles :**
- Erreur dans `createBlankPdf()`
- Problème avec `pdf-lib`

**Solution :**
- Vérifier les erreurs dans la console
- Vérifier que `pdfService.createBlankPdf()` fonctionne

## Commandes de Débogage

```bash
# Démarrer le serveur avec logs détaillés
cd pdf-ditor
ng serve --verbose

# Vérifier les erreurs de compilation
ng build

# Vérifier les erreurs de lint
ng lint
```

## Logs Ajoutés

Les logs suivants ont été ajoutés pour faciliter le débogage :

- `"Outil sélectionné:"` - Quand un outil est sélectionné
- `"Clic sur canvas:"` - Quand on clique sur le PDF
- `"Clic sur la page:"` - Quand le clic est traité
- `"Champ ajouté:"` - Quand un champ est créé
- `"Total champs:"` - Nombre total de champs

## Vérifications Rapides

1. ✅ Le serveur Angular est démarré
2. ✅ Aucune erreur dans la console
3. ✅ Un outil est sélectionné avant de cliquer
4. ✅ Le PDF est chargé (ou créé)
5. ✅ Les champs apparaissent dans `currentDocument.fields`



