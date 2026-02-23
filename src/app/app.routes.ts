import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/admin',
    pathMatch: 'full',
  },
  {
    path: 'admin',
    loadComponent: () => import('./components/admin/admin.component').then(m => m.AdminComponent),
  },
  {
    path: 'admin/template/:id',
    loadComponent: () => import('./components/admin/template-editor/template-editor.component').then(m => m.TemplateEditorComponent),
  },
  {
    path: 'forms',
    loadComponent: () => import('./components/forms/forms-list/forms-list.component').then(m => m.FormsListComponent),
  },
  {
    path: 'forms/fill/:id',
    loadComponent: () => import('./components/forms/form-filler/form-filler.component').then(m => m.FormFillerComponent),
  },
  {
    path: 'editor',
    loadComponent: () => import('./app.component').then(m => m.AppComponent),
  },
];
