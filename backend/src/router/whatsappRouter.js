import express from "express";
import { body, query, validationResult } from "express-validator";
import { randomUUID } from "crypto";
import { isAuth } from "../middleware/auth.js";
import { Integration } from "../model/integration.js";
import { exchangeBusinessToken, fetchPhoneNumber, fetchWaba } from "../connection/meta.js";
import Env from "../util/Env.js";

const WhatsappRouter = express.Router();

/** Monta a `Error` com `status` e `code` que o `errorHandler` devolve ao SPA. */
function fail(message, status, code) {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    return error;
}

/**
 * POST /v1/whatsapp/connect
 * -----------------------------------------------------------------------------
 * Prepara a conexão antes do popup: cria (ou reutiliza) a linha `integration`
 * do usuário em `processing` e devolve um `connect_code` de uso único. O SPA
 * guarda esse código e o envia de volta no `/callback` junto com o `code` da
 * Meta — é o que prova que o popup foi aberto por esta sessão.
 *
 * Chamado na abertura do modal explicativo, não no clique do "Conectar": o
 * `FB.login` precisa disparar dentro do gesto do usuário, sem um `await`
 * antes, senão o navegador bloqueia o popup.
 */
WhatsappRouter.post('/connect', isAuth, async (req, res, next) => {
    try {
        const user_id = req.auth.data.sub;
        const connect_code = randomUUID();

        let integration = await Integration.findOne({
            where: { user_id: user_id, provider: 'whatsapp' },
            order: [['created_at', 'DESC']]
        });

        let whatsappChannel = await Channel.findOne({
            where: { type: 'whatsapp' }
        })

        if (integration) {
            integration.status = 'processing';
            integration.icon_url = "/public/images/whatsapp-logo.png";
            integration.credentials = null;
            integration.channel_id = whatsappChannel.id
            integration.metadata = { ...(integration.metadata || {}), connect_code };
            await integration.save();
        } else {
            integration = await Integration.create({
                user_id: user_id,
                icon_url: "/public/images/whatsapp-logo.png",
                credentials: null,
                channel_id: whatsappChannel.id,
                provider: 'whatsapp',
                label: 'WhatsApp',
                auth_type: 'oauth2',
                status: 'processing',
                metadata: { connect_code }
            });
        }

        res.status(200).json({ connect_code });
    } catch (err) { next(err); }
});

WhatsappRouter.post('/callback', [
    body('connect_code').notEmpty().withMessage('O código de conexão é obrigatório.').isString().withMessage('O código de conexão deve ser uma string.'),
    body('code').notEmpty().withMessage('O código de autorização é obrigatório.').isString().withMessage('O código de autorização deve ser uma string.'),
    body('waba_id').notEmpty().withMessage('O ID da conta WhatsApp é obrigatório.').isString().withMessage('O ID da conta WhatsApp deve ser uma string.'),
    body('phone_number_id').notEmpty().withMessage('O ID do número é obrigatório.').isString().withMessage('O ID do número deve ser uma string.'),
], isAuth, async (req, res, next) => {
    try {
        const validation = validationResult(req);
        if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

        const user_id = req.auth.data.sub;

        const integration = await Integration.findOne({
            where: { user_id, provider: 'whatsapp' },
            order: [['created_at', 'DESC']]
        });

        if (!integration || integration.metadata?.connect_code !== req.body.connect_code) {
            throw fail('Conexão não iniciada ou expirada. Feche e abra novamente.', 403, 'WHATSAPP_CONNECT_CODE_INVALID');
        }

        // A troca exige o App Secret e o TTL do code é de 30 segundos: na hora.
        const business_token = await exchangeBusinessToken(req.body.code);

        // Os IDs vêm do popup; só valem se o token novo conseguir lê-los.
        const waba = await fetchWaba(req.body.waba_id, business_token);
        const phone = await fetchPhoneNumber(req.body.phone_number_id, business_token);

        const { connect_code, ...metadata } = integration.metadata || {};

        integration.status = 'active';
        integration.label = `${phone.display_phone_number}`;
        integration.credentials = JSON.stringify({
            business_token,
            app_id: Env.getMetaAppId(),
            graph_version: Env.getMetaGraphVersion()
        });
        integration.metadata = {
            ...metadata,
            waba_id: req.body.waba_id,
            phone_number_id: req.body.phone_number_id,
            display_phone_number: phone.display_phone_number ?? null,
            verified_name: phone.verified_name ?? null,
            quality_rating: phone.quality_rating ?? null,
            waba_name: waba.name ?? null,
            connected_at: new Date().toISOString()
        };

        await integration.save();

        res.status(200).json({
            waba_id: req.body.waba_id,
            phone_number_id: req.body.phone_number_id,
            display_phone_number: phone.display_phone_number ?? null
        });
    } catch (err) { next(err); }
});

WhatsappRouter.get('/webhook', [
    query('hub.mode').optional().isString().withMessage('O modo do hub deve ser um texto.'),
    query('hub.verify_token').optional().isString().withMessage('O token de verificação do hub deve ser um texto.'),
    query('hub.challenge').optional().isString().withMessage('O desafio do hub deve ser um texto.'),
], (req, res) => {
    const validation = validationResult(req);
    if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (!Env.getWabaVerifyToken()) {
        return res.status(500).json({ error: 'Verify token não configurado no servidor.' });
    }

    if (mode === 'subscribe' && token === Env.getWabaVerifyToken()) {
        return res.status(200).type('text/plain').send(String(challenge ?? ''));
    }

    return res.status(403).json({ error: 'Falha na verificação do webhook.' });
});

export { WhatsappRouter };
