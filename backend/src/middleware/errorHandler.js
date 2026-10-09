import Utils from "../util/Util.js";

export const errorHandler = (err, req, res, next) => {

    const statusCode = err.status || err.statusCode || 500;
    
    const message = err.message || 'Erro interno do servidor';

    const type = err.name || 'Erro';

    console.error(`[Error] ${statusCode} - ${type} - ${message}`, {
        path: req.originalUrl,
        method: req.method,
        stack: err.stack
    });

    res.status(statusCode).json({
		type: type,
        error: message,
        ...(Utils.getCurrentEnroviment() === 'dev' && { stack: err.stack })
    });
};