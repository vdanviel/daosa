export class ApiError extends Error {
    
    constructor(message, type, status) {
        super(message);
        this.name = type;
        this.status = status;
    }

    /** Recurso/dado não existe. */
    static notFound(message, status = 404) {
        return new ApiError(message, 'Not Found', status);
    }

    /** Dado inválido, duplicado ou código expirado. */
    static validation(message, status = 400) {
        return new ApiError(message, 'Validation', status);
    }

    /** Credenciais erradas. */
    static unauthorized(message, status = 401) {
        return new ApiError(message, 'Unauthorized', status);
    }

    /** Autenticado, mas bloqueado ou sem permissão. */
    static forbidden(message, status = 403) {
        return new ApiError(message, 'Forbidden', status);
    }

    /** Falha interna nossa. */
    static internal(message, status = 500) {
        return new ApiError(message, 'InternalError', status);
    }

    /** Serviço deliberadamente desativado. */
    static unavailable(message, status = 503) {
        return new ApiError(message, 'Unavailable', status);
    }
}
