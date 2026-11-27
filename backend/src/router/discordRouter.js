import express from "express";
import { query, body, validationResult } from "express-validator";
import { isAuth } from "../middleware/auth.js";
import { Integration } from "../model/integration.js";
import { randomUUID } from "crypto";
import { Op } from "sequelize";
import { getDiscordAuthorizationUrl, getDiscordAccessTokens, fetchBotGuilds } from "../connection/discord.js";
import Env from "../util/Env.js";
import { Channel } from "../model/channel.js";

const DiscordRouter = express.Router();

/**
 * POST /v1/discord/connect
 * Prepara a conexão: cria (ou reutiliza) a linha `integration` do usuário em `processing`
 * e devolve o link de autorização do Discord OAuth2.
 *
 * Recebe os dados de texto do agente que o usuário já digitou (`agent_*`) para
 * devolver na query do redirect do callback, além de uma flag `channel=discord`
 * para o frontend já deixar o canal Discord selecionado ao voltar da tela.
 */
DiscordRouter.post('/connect', [
  body('return_path').notEmpty().withMessage('Caminho para retorno é obrigatório.').isString().withMessage('Caminho de retorno deve ser uma string.'),
  body('agent_name').optional(),
  body('agent_objective').optional(),
  body('agent_description').optional(),
  body('agent_temp').optional(),
  body('agent_top_p').optional(),
  body('agent_token_limit').optional(),
], isAuth, async (req, res, next) => {
  try {
    const user_id = req.auth.data.sub;
    const randCode = randomUUID();

    let integration = await Integration.findOne({
      where: { user_id: user_id, provider: 'discord' },
      order: [['created_at', 'DESC']]
    });

    let discordChannel = await Channel.findOne({
      where: { type: 'discord' }
    })

    if (integration) {
      integration.status = 'processing';
      integration.channel_id = discordChannel.id
      integration.credentials = null;
      integration.metadata = {
        ...(integration.metadata || {}),
        antifraud_onboard_code: randCode
      };
      await integration.save();
    } else {
      integration = await Integration.create({
        user_id: user_id,
        channel_id: discordChannel.id,
        provider: 'discord',
        label: 'Discord',
        auth_type: 'oauth2',
        status: 'processing',
        metadata: { antifraud_onboard_code: randCode }
      });
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
        agent_token_limit: encodeField(req.body.agent_token_limit),
        channel: encodeField('discord') // flag: front já deixa o canal Discord selecionado no retorno
      },
      antifraud_onboard_code: randCode
    };

    const consentLink = getDiscordAuthorizationUrl(JSON.stringify(stateData));

    res.status(200).json({ d_consent_link: consentLink });
  } catch (err) { next(err); }
});

/**
 * GET /v1/discord/oauth/callback
 * Callback do OAuth do Discord. Recebe `code` e `state`, troca o code por tokens,
 * salva a integração como ativa e redireciona de volta para o frontend.
 */
DiscordRouter.get('/oauth/callback', [
  query('code').notEmpty().withMessage('Código de autorização é obrigatório.'),
  query('state').notEmpty().withMessage('Código de estado é obrigatório.'),
], async (req, res, next) => {
  try {
    const validation = validationResult(req);
    if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

    let stateData;
    try {
      stateData = JSON.parse(req.query.state);
    } catch {
      return res.status(400).json({ error: 'State inválido.' });
    }

    const integration = await Integration.findOne({
      where: {
        id: stateData.integration_id,
        user_id: stateData.user_id,
        provider: 'discord'
      }
    });

    if (!integration) {
      return res.status(403).send('Integração não encontrada.');
    }

    // Remove integrações "processing" antigas do mesmo usuário/provider
    await Integration.destroy({
      where: {
        id: { [Op.ne]: integration.id },
        user_id: stateData.user_id,
        provider: 'discord'
      }
    });

    if (integration.metadata?.antifraud_onboard_code !== stateData.antifraud_onboard_code) {
      return res.status(403).send('Código fraudulento detectado.');
    }

    // Troca o code por tokens
    const tokenData = await getDiscordAccessTokens(req.query.code);

    // Busca as guilds do bot para incluir nos metadados
    let botGuilds = [];
    try {
      botGuilds = await fetchBotGuilds(tokenData.access_token);
    } catch (e) {
      console.warn('Failed to fetch bot guilds:', e.message);
    }

    integration.status = 'active';
    integration.label = `Discord Bot`;
    integration.credentials = JSON.stringify({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expiry_date: Date.now() + (tokenData.expires_in * 1000),
      token_type: tokenData.token_type,
      scope: tokenData.scope
    });
    integration.metadata = {
      ...integration.metadata,
      bot_guilds: botGuilds.map(g => ({ id: g.id, name: g.name, icon: g.icon, owner: g.owner })),
      connected_at: new Date().toISOString()
    };

    await integration.save();

    // Volta para o SPA com os dados do agente digitados antes de integrar
    // (mesmo esquema do Google OAuth) + flag para já selecionar o canal Discord.
    const decodeField = (value) => value === undefined || value === null || value === '' ? null : Buffer.from(String(value), 'base64url').toString('utf8');

    const resumeQuery = Object.entries(stateData.resume_data || {}).map(([key, value]) => `${key}=${encodeURIComponent(decodeField(value) ?? '')}`).join('&');

    // Redireciona de volta para o frontend
    res.redirect(`${stateData.target_uri}${stateData.target_uri.includes('?') ? '&' : '?'}${resumeQuery}`);
  } catch (err) { next(err); }
});

/**
 * GET /v1/discord/webhook
 * Endpoint para receber eventos do Discord (interactions, messages, etc.)
 * Valida a assinatura usando a PUBLIC_KEY do Discord.
 */
DiscordRouter.post('/webhook', express.raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    const publicKey = Env.getDiscordPublicKey();

    if (!publicKey) {
      return res.status(500).json({ error: 'Discord public key not configured.' });
    }

    // TODO: Implementar verificação de assinatura Ed25519
    // Por enquanto, aceita a requisição
    const body = JSON.parse(req.body.toString());

    // Responde a PING (type 1) para verificação do webhook
    if (body.type === 1) {
      return res.status(200).json({ type: 1 }); // PONG
    }

    // TODO: Processar outros tipos de interaction (APPLICATION_COMMAND, etc.)
    return res.status(200).json({ type: 4, data: { content: 'Comando recebido!' } });
  } catch (err) { next(err); }
});

export { DiscordRouter };