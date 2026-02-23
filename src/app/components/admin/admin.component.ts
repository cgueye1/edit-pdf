import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TemplateService } from '../../services/template.service';
import { FormTemplate, TemplateCategory } from '../../models/template.model';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css'],
})
export class AdminComponent implements OnInit {
  templates: FormTemplate[] = [];
  categories: TemplateCategory[] = [];
  filteredTemplates: FormTemplate[] = [];
  selectedCategory: string = 'all';
  searchQuery: string = '';
  showCreateModal = false;
  newTemplateName = '';
  newTemplateDescription = '';
  newTemplateCategory = '';

  constructor(
    private templateService: TemplateService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadTemplates();
    this.categories = this.templateService.getCategories();
  }

  loadTemplates(): void {
    this.templates = this.templateService.getAllTemplates();
    this.applyFilters();
  }

  applyFilters(): void {
    let filtered = [...this.templates];

    // Filtre par catégorie
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.category === this.selectedCategory);
    }

    // Filtre par recherche
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query)) ||
        (t.metadata.tags && t.metadata.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }

    this.filteredTemplates = filtered;
  }

  onCategoryChange(): void {
    this.applyFilters();
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  openCreateModal(): void {
    this.showCreateModal = true;
    this.newTemplateName = '';
    this.newTemplateDescription = '';
    this.newTemplateCategory = '';
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  createNewTemplate(): void {
    if (!this.newTemplateName.trim()) {
      alert('Veuillez saisir un nom pour le template');
      return;
    }

    // Rediriger vers l'éditeur avec un nouveau template
    this.router.navigate(['/admin/template/new'], {
      queryParams: {
        name: this.newTemplateName,
        description: this.newTemplateDescription,
        category: this.newTemplateCategory,
      },
    });
  }

  editTemplate(template: FormTemplate): void {
    this.router.navigate(['/admin/template', template.id]);
  }

  deleteTemplate(template: FormTemplate): void {
    if (confirm(`Êtes-vous sûr de vouloir supprimer le template "${template.name}" ?`)) {
      if (this.templateService.deleteTemplate(template.id)) {
        this.loadTemplates();
        alert('Template supprimé avec succès');
      } else {
        alert('Erreur lors de la suppression');
      }
    }
  }

  duplicateTemplate(template: FormTemplate): void {
    const duplicated: FormTemplate = {
      ...template,
      id: this.generateId(),
      name: `${template.name} (Copie)`,
      metadata: {
        ...template.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0',
      },
    };
    this.templateService.saveTemplate(duplicated);
    this.loadTemplates();
  }

  getCategoryName(categoryId: string): string {
    const category = this.categories.find(c => c.id === categoryId);
    return category ? category.name : categoryId;
  }

  getCategoryIcon(categoryId: string): string {
    const category = this.categories.find(c => c.id === categoryId);
    return category?.icon || 'fa-file';
  }

  getCategoryColor(categoryId: string): string {
    const category = this.categories.find(c => c.id === categoryId);
    return category?.color || '#999999';
  }

  getSubmissionsCount(templateId: string): number {
    return this.templateService.getSubmissionsByTemplate(templateId).length;
  }

  private generateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}













