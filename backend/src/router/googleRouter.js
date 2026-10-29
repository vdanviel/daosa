import express from "express";
import { query, body, validationResult } from "express-validator";
import { getGoogleAuthorizationUrl, getUserAcessTokens } from "../connection/google.js";
import { isAuth } from "../middleware/auth.js";
import { Integration } from "../model/integration.js";
import { randomUUID } from "crypto";
import { Op } from "sequelize";
import Env from "../util/Env.js";

const GoogleRouter = express.Router();

GoogleRouter.post('/consent-screen', [
    body('return_path').notEmpty().withMessage('Caminho para retorno é obrigatório.').isString().withMessage('Caminho de retorno deve ser uma string.'),
    body('agent_name').optional(),
    body('agent_objective').optional(),
    body('agent_description').optional(),
    body('agent_temp').optional().isInt().withMessage('Temperatura deve ser um número inteiro.'),
    body('agent_top_p').optional().isInt().withMessage('Top p deve ser um número inteiro.'),
    body('agent_token_limit').optional().isInt().withMessage('Limite de token deve ser um número inteiro.'),
], isAuth, async (req, res) => {

    let integration = await Integration.findOne({
        where: {
            user_id: req.auth.data.sub,
            provider: 'google'
        },
        order: [['created_at', 'DESC']]
    });

    const randCode = randomUUID();

    if (integration) {
        integration.status = 'processing';
        integration.credentials = null;
        integration.metadata = {
            ...(integration.metadata || {}),
            antifraud_onboard_code: randCode
        };
        await integration.save();
    } else {
        integration = new Integration();

        integration.user_id = req.auth.data.sub;
        integration.provider = 'google';
        integration.label = "Conta Google";
        integration.auth_type = "oauth2";
        integration.status = "processing";
        integration.metadata = { antifraud_onboard_code: randCode };

        await integration.save();
    }

    //mini função para tratar de encode dos campos enviados para evitar bugs de caracteres especiais...
    const encodeField = (value) => value === undefined || value === null || value === '' ? null : Buffer.from(String(value), 'utf8').toString('base64url');

    //confirma se caminho para retorno é string e tem / (barra)
    const returnPath = typeof req.body.return_path === 'string' && /^\/(?!\/)/.test(req.body.return_path) ? req.body.return_path : '/';

    const stateData = {
        integration_id: integration.id,
        user_id: req.auth.data.sub,
        target_uri: `${(Env.getSpaApplicationUrl() || '').replace(/\/+$/, '')}${returnPath}`,
        resume_data: {
            agent_name: encodeField(req.body.agent_name),
            agent_objective: encodeField(req.body.agent_objective),
            agent_description: encodeField(req.body.agent_description),
            agent_temp: encodeField(req.body.agent_temp),
            agent_top_p: encodeField(req.body.agent_top_p),
            agent_token_limit: encodeField(req.body.agent_token_limit)
        },
        antifraud_onboard_code: randCode
    }

    ///retornar o link de tela de consentimento consentimento com dados necessários em "state"...
    const consentGoogleLink = getGoogleAuthorizationUrl(JSON.stringify(stateData));

    res.status(200).json({g_consent_link: consentGoogleLink});

});

GoogleRouter.get('/oauth/callback', [
    query('code').notEmpty().withMessage('Código de autorização é obrigatório.'),
    query('state').notEmpty().withMessage('Código de estado é obrigatório.'),
], async (req, res) => {

    const validation = validationResult(req);
    if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

    const stateData = JSON.parse(req.query.state);

    const integration = await Integration.findOne({
        where: {
            id: stateData.integration_id,
            user_id: stateData.user_id,
            provider: 'google'
        }
    });

    if(!integration) throw Error("Integração não encontrada.", {status: 403});

    //deletar as integrações "processing" inúteis desse user...
    await Integration.destroy({
        where:{            
            id:{
                [Op.ne]: integration.id
            },
            user_id: stateData.user_id,
            provider: 'google'
        }
    });

    if(integration.metadata.antifraud_onboard_code != stateData.antifraud_onboard_code) throw Error("Código fraudulento detectado.", {status: 403});

    //gerar tokens de acesso do usuario...
    const g_user_data = await getUserAcessTokens(req.query.code);

    integration.status = "active";
    integration.credentials = JSON.stringify({
        access_token: g_user_data.access_token,
        refresh_token: g_user_data.refresh_token,
        expiry_date: g_user_data.expiry_date
    });

    delete g_user_data.access_token;
    delete g_user_data.refresh_token;
    delete g_user_data.expiry_date;

    integration.metadata = {...integration.metadata, g_user_data};

    await integration.save();
    
    const decodeField = (value) => value === undefined || value === null || value === '' ? null : Buffer.from(String(value), 'base64url').toString('utf8');

    const resumeQuery = Object.entries(stateData.resume_data || {}).map(([key, value]) => `${key}=${encodeURIComponent(decodeField(value) ?? '')}`).join('&');

    res.redirect(`${stateData.target_uri}${stateData.target_uri.includes('?') ? '&' : '?'}${resumeQuery}`);

});

export {GoogleRouter}