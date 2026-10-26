import express from "express";
import { query, body, validationResult } from "express-validator";
import { getGoogleAuthorizationUrl, getUserAcessTokens, createGoogleDriveClient } from "../connection/google.js";
import { isAuth } from "../middleware/auth.js";
import { Integration } from "../model/integration.js";
import { randomUUID } from "crypto";
import { Op } from "sequelize";
import Env from "../util/Env.js";

const GoogleRouter = express.Router();

// ENCODER MEDIADOR DOS CAMPOS DO FORMULÁRIO
// `agent_*` viajam dentro do `state` do OAuth, e o Google reencodifica esse
// parâmetro várias vezes na cadeia de consentimento (continue/opparams): um
// caractere especial no texto digitado quebrava o fluxo e a tela estourava 500.
// Base64url reduz tudo a [A-Za-z0-9_-], que sobrevive a qualquer rodada de
// encode/decode — e o callback devolve o texto original para a query do redirect.
const encodeField = (value) =>
    value === undefined || value === null || value === ''
        ? null
        : Buffer.from(String(value), 'utf8').toString('base64url');

const decodeField = (value) =>
    value === undefined || value === null || value === ''
        ? null
        : Buffer.from(String(value), 'base64url').toString('utf8');

GoogleRouter.post('/consent-screen', [
    body('agent_name').optional(),
    body('agent_objective').optional(),
    body('agent_description').optional(),
    body('agent_temp').optional().isInt().withMessage('Temperatura deve ser um número inteiro.'),
    body('agent_top_p').optional().isInt().withMessage('Top p deve ser um número inteiro.'),
    body('agent_token_limit').optional().isInt().withMessage('Limite de token deve ser um número inteiro.'),
], isAuth, async (req, res) => {
    
    //começar registrar o integration...
    const integration = new Integration();

    integration.user_id = req.auth.data.sub;
    integration.provider = 'google';
    integration.label = "Conta Google";
    integration.auth_type = "oauth2";
    integration.status = "processing";

    const randCode = randomUUID();
    integration.metadata = { antifraud_onboard_code: randCode };

    await integration.save();

    // Caminho relativo para onde o usuário volta depois do consentimento.
    // Só aceita path iniciando com uma única barra: nunca um host externo (open redirect).
    const returnPath =
        typeof req.body.return_path === 'string' && /^\/(?!\/)/.test(req.body.return_path)
            ? req.body.return_path
            : '/';

    //dados necessários para o callback...
    // Os campos do form entram CODIFICADOS (ver encodeField) — o texto puro não
    // pode ir nas URLs do Google.
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

    res.status(200).json({consent_g_link: consentGoogleLink});

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
    const gUserData = await getUserAcessTokens(req.query.code);

    //completar o registro de integration...
    integration.status = "active";
    integration.credentials = JSON.stringify({access_token: gUserData.access_token, refresh_token: gUserData.refresh_token});

    delete gUserData.access_token;
    delete gUserData.refresh_token;

    integration.metadata = {...integration.metadata, gUserData};

    integration.save();

    // return_path pode já ter query (`/dashboard/agents?edit=12`): separador muda.
    // Aqui os campos voltam em texto puro: o decode é local, sem Google no meio.
    const resumeQuery = Object.entries(stateData.resume_data || {})
        .map(([key, value]) => `${key}=${encodeURIComponent(decodeField(value) ?? '')}`)
        .join('&');

    res.redirect(`${stateData.target_uri}${stateData.target_uri.includes('?') ? '&' : '?'}${resumeQuery}`);

});

export {GoogleRouter}