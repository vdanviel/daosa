import jwt from 'jsonwebtoken';
import Env from '../util/Env.js';

const JWT_SECRET = Env.getJwtSecret();

const isAuth = (req, res, next) => {
    if (!req || !req.headers) {
        return res.status(500).json({ error: 'Invalid request object' });
    }

    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader && authHeader.split(' ')[1]; // Se o cabeçalho existir, ele divide o conteúdo por espaço e pega o segundo item (o token em si)

    if (!bearerToken) {
        return res.status(401).json({ jwt_missing: 'No token provided.' });
    }

    jwt.verify(bearerToken, JWT_SECRET, (err, decoded) => {
        
        if (err) {
            console.log(err);
            return res.status(403).json({ jwt_invalid: 'Invalid or expired token.' });
        }else{
            req.auth = decoded;

            console.log(req.auth)

            next();
        }
    
    });
};

export {isAuth};