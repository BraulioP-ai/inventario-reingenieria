export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const noEncontrado = (que = 'Recurso') => new HttpError(404, `${que} no encontrado`);
