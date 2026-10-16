import jwt from 'jsonwebtoken';
import Env from '../util/Env.js';

const checkScope = (requiredScope) => {
    
    return (req, res, next) => {
        const token = req.headers.authorization?.split(' ')[1];
        
        try {
            const decoded = jwt.verify(token, Env.getJwtSecret());
            if (!decoded.scope || !decoded.scope.includes(requiredScope)) {
                return res.status(403).json({ scope_error: 'Not allowed. Insufficient permission.' });
            }
            next();
        } catch (err) {
            return res.status(401).json({ jwt_invalid: 'Invalid or expired token.' });
        }

    };
};

export {checkScope};