# Architecture de l'Application de Gestion de Formulaires PDF

## Vue d'ensemble

Cette application permet aux administrateurs de créer et gérer des templates de formulaires PDF personnalisés, et aux utilisateurs finaux de remplir ces formulaires en ligne.

## Structure du Projet

### Modèles de Données

#### `FormTemplate` (`src/app/models/template.model.ts`)
- Structure complète d'un template de formulaire
- Contient les champs, métadonnées, paramètres
- Peut inclure un PDF de base

#### `TemplateField` (`src/app/models/template.model.ts`)
- Extension de `PDFField` avec propriétés avancées
- Validation complète
- Options spécifiques par type de champ
- Affichage conditionnel

#### `FormSubmission` (`src/app/models/template.model.ts`)
- Instance de formulaire rempli
- Contient les valeurs saisies
- PDF généré avec les données
- Statut (brouillon, soumis, approuvé, rejeté)

### Services

#### `TemplateService` (`src/app/services/template.service.ts`)
- Gestion CRUD des templates
- Validation des champs
- Gestion des soumissions
- Gestion des catégories
- Stockage dans localStorage

#### `PdfService` (`src/app/services/pdf.service.ts`)
- Manipulation des PDFs avec pdf-lib
- Ajout de champs (texte, checkbox, input, textarea, image, signature)
- Export de PDFs

### Composants

#### Mode Administration (`/admin`)

**AdminComponent** (`src/app/components/admin/admin.component.ts`)
- Liste tous les templates
- Recherche et filtrage par catégorie
- Création, édition, suppression, duplication de templates

**TemplateEditorComponent** (`src/app/components/admin/template-editor/template-editor.component.ts`)
- Édition visuelle des templates
- Ajout de champs sur le PDF
- Configuration des propriétés et validations
- Sauvegarde des templates

#### Mode Utilisateur (`/forms`)

**FormsListComponent** (`src/app/components/forms/forms-list/forms-list.component.ts`)
- Liste des formulaires disponibles
- Recherche et filtrage
- Navigation vers le remplissage

**FormFillerComponent** (`src/app/components/forms/form-filler/form-filler.component.ts`)
- Interface de remplissage de formulaire
- Validation en temps réel
- Aperçu PDF en direct
- Soumission et sauvegarde de brouillon

### Routing

```
/ → Redirige vers /admin
/admin → Liste des templates (AdminComponent)
/admin/template/:id → Éditeur de template (TemplateEditorComponent)
/forms → Liste des formulaires (FormsListComponent)
/forms/fill/:id → Remplissage de formulaire (FormFillerComponent)
/editor → Éditeur PDF original (AppComponent)
```

## Fonctionnalités

### Types de Champs Supportés

1. **Texte** (`text`)
   - Texte libre
   - Propriétés de style (taille, couleur, police)

2. **Champ texte** (`input`)
   - Ligne de saisie
   - Label et placeholder
   - Validation (longueur min/max, pattern)

3. **Zone de texte** (`textarea`)
   - Texte multiligne
   - Label et placeholder

4. **Case à cocher** (`checkbox`)
   - Booléen

5. **Date** (`date`)
   - Sélecteur de date
   - Format personnalisable

6. **Nombre** (`number`)
   - Validation min/max
   - Format monétaire optionnel

7. **Email** (`email`)
   - Validation automatique du format

8. **Image** (`image`)
   - Upload d'image
   - Formats supportés : PNG, JPG, JPEG

9. **Signature** (`signature`)
   - Canvas de signature
   - Dessin à la souris

### Validation

- **Required** : Champ obligatoire
- **MinLength/MaxLength** : Longueur de texte
- **Min/Max** : Valeurs numériques
- **Pattern** : Expression régulière
- **Email** : Validation automatique du format
- **Messages d'erreur personnalisés**

### Catégories

Catégories par défaut :
- Bancaire
- Ressources Humaines
- Administratif
- Juridique
- Autre

## Stockage

Tous les données sont stockées dans le **localStorage** du navigateur :
- `pdf_form_templates` : Templates de formulaires
- `pdf_form_submissions` : Soumissions de formulaires
- `pdf_form_categories` : Catégories

## Workflow

### Création d'un Template (Admin)

1. Accéder à `/admin`
2. Cliquer sur "Nouveau Template"
3. Saisir le nom, description, catégorie
4. Créer un PDF vierge ou charger un PDF existant
5. Ajouter des champs en cliquant sur le PDF
6. Configurer les propriétés de chaque champ :
   - Nom, label, placeholder
   - Validation (required, min/max, pattern)
   - Options spécifiques au type
7. Sauvegarder le template

### Remplissage d'un Formulaire (User)

1. Accéder à `/forms`
2. Sélectionner un formulaire
3. Remplir les champs
4. Validation en temps réel
5. Aperçu PDF en direct
6. Sauvegarder en brouillon ou soumettre
7. Téléchargement automatique du PDF final

## Technologies Utilisées

- **Angular 17** : Framework frontend
- **pdf-lib** : Manipulation de PDFs
- **pdfjs-dist** : Affichage de PDFs
- **file-saver** : Téléchargement de fichiers
- **signature_pad** : Gestion des signatures
- **localStorage** : Stockage local

## Améliorations Futures

1. **Backend** : Migration vers une base de données (PostgreSQL)
2. **Authentification** : Système de login pour les admins
3. **Types de champs supplémentaires** :
   - Select/Dropdown
   - Radio buttons
   - Fichiers PDF
4. **Workflow d'approbation** : Validation des soumissions
5. **Notifications** : Alertes par email
6. **Statistiques** : Tableaux de bord pour les admins
7. **Export de données** : CSV, Excel
8. **Templates partagés** : Partage entre organisations













