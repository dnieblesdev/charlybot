import { HttpErrorResponse } from '@angular/common/http';

export function getErrorMessage(error: HttpErrorResponse): string {
  if (error.error?.message) {
    return error.error.message;
  }
  if (error.message) {
    return error.message;
  }
  switch (error.status) {
    case 0:
      return 'No se pudo conectar al servidor';
    case 401:
      return 'No autorizado';
    case 403:
      return 'Acceso denegado';
    case 404:
      return 'Recurso no encontrado';
    case 500:
      return 'Error interno del servidor';
    default:
      return `Error ${error.status}`;
  }
}
