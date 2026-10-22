export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }

  static notFound(what: string, id: string) {
    return new AppError(404, `${what} ${id} not found`);
  }

  static forbidden(message: string) {
    return new AppError(403, message);
  }

  static badRequest(message: string) {
    return new AppError(400, message);
  }
}
