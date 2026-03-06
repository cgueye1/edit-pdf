import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TemplateService } from '../../../services/template.service';
import { FormTemplate, TemplateCategory } from '../../../models/template.model';

@Component({
  selector: 'app-forms-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './forms-list.component.html',
  styleUrls: ['./forms-list.component.css'],
})
export class FormsListComponent implements OnInit {
  templates: FormTemplate[] = [];
  categories: TemplateCategory[] = [];
  filteredTemplates: FormTemplate[] = [];
  selectedCategory: string = 'all';
  searchQuery: string = '';

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

    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.category === this.selectedCategory);
    }

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query))
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

  fillForm(template: FormTemplate): void {
    this.router.navigate(['/forms/fill', template.id]);
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
}

















