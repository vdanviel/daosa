import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from "supertest";
import { Integration } from '../../src/model/integration.js';
import { Channel, initializeChannels } from '../../src/model/channel.js';
import { validJWTUser } from "../helper/http.js";
import { app } from "../setup/testIndex.js";
import { exchangeBusinessToken, fetchPhoneNumber, fetchWaba } from '../../src/connection/meta.js';

/**
 * A Graph API é substituída aqui: nenhum teste fala com a Meta. O que se cobre
 * é o contrato do router — status, gravação na `integration` e recusa quando o
 * `connect_code` não bate.
 */
vi.mock('../../src/connection/meta.js', () => ({
    exchangeBusinessToken: vi.fn(),
    fetchWaba: vi.fn(),
    fetchPhoneNumber: vi.fn()
}));

const PROVIDER = 'whatsapp';

const validBody = {
    connect_code: 'qualquer',
    code: 'code-da-meta',
    waba_id: '123456789',
    phone_number_id: '987654321'
};

async function connect(jwt) {
    const response = await request(app)
        .post('/v1/whatsapp/connect')
        .set('Authorization', `Bearer ${jwt}`)
        .send({});

    return response;
}

beforeEach(async () => {
    await Integration.destroy({ where: { provider: PROVIDER } });

    vi.clearAllMocks();
    exchangeBusinessToken.mockResolvedValue('BUSINESS_TOKEN_TEST');
    fetchWaba.mockResolvedValue({ name: 'Loja Teste' });
    fetchPhoneNumber.mockResolvedValue({
        display_phone_number: '+55 11 99999-0000',
        verified_name: 'Loja Teste',
        quality_rating: 'GREEN'
    });
});

describe('/v1/whatsapp/connect', () => {

    it('recusa sem token', async () => {
        const response = await request(app).post('/v1/whatsapp/connect').send({});

        expect(response.status).toBe(401);
    });

    it('cria a integração em processing e devolve o connect_code', async () => {
        const jwt = await validJWTUser();
        const response = await connect(jwt);

        expect(response.status).toBe(200);
        expect(response.body.connect_code).toBeTruthy();

        const integration = await Integration.findOne({ where: { provider: PROVIDER } });
        expect(integration.status).toBe('processing');
        expect(integration.metadata.connect_code).toBe(response.body.connect_code);
    });

    it('reutiliza a mesma linha na reconexão', async () => {
        const jwt = await validJWTUser();

        await connect(jwt);
        const second = await connect(jwt);

        expect(second.status).toBe(200);

        const rows = await Integration.findAll({ where: { provider: PROVIDER } });
        expect(rows).toHaveLength(1);
        expect(rows[0].metadata.connect_code).toBe(second.body.connect_code);
    });

});

describe('/v1/whatsapp/callback', () => {

    it('recusa sem token', async () => {
        const response = await request(app).post('/v1/whatsapp/callback').send(validBody);

        expect(response.status).toBe(401);
    });

    it('recusa connect_code que não bate', async () => {
        const jwt = await validJWTUser();
        await connect(jwt);

        const response = await request(app)
            .post('/v1/whatsapp/callback')
            .set('Authorization', `Bearer ${jwt}`)
            .send({ ...validBody, connect_code: 'errado' });

        expect(response.status).toBe(403);
        expect(response.body.code).toBe('WHATSAPP_CONNECT_CODE_INVALID');
        expect(exchangeBusinessToken).not.toHaveBeenCalled();
    });

    it('não grava quando o token não alcança os assets', async () => {
        const jwt = await validJWTUser();
        const { body } = await connect(jwt);

        fetchWaba.mockRejectedValue(Object.assign(new Error('negado'), { status: 403, code: 'WHATSAPP_ASSET_UNAUTHORIZED' }));

        const response = await request(app)
            .post('/v1/whatsapp/callback')
            .set('Authorization', `Bearer ${jwt}`)
            .send({ ...validBody, connect_code: body.connect_code });

        expect(response.status).toBe(403);
        expect(response.body.code).toBe('WHATSAPP_ASSET_UNAUTHORIZED');

        const integration = await Integration.findOne({ where: { provider: PROVIDER } });
        expect(integration.status).toBe('processing');
        expect(integration.credentials).toBeNull();
    });

    it('grava token e IDs e ativa a integração', async () => {
        const jwt = await validJWTUser();
        const { body } = await connect(jwt);

        const response = await request(app)
            .post('/v1/whatsapp/callback')
            .set('Authorization', `Bearer ${jwt}`)
            .send({ ...validBody, connect_code: body.connect_code });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            waba_id: '123456789',
            phone_number_id: '987654321',
            display_phone_number: '+55 11 99999-0000'
        });

        const integration = await Integration.findOne({ where: { provider: PROVIDER } });
        expect(integration.status).toBe('active');
        expect(integration.label).toBe('WhatsApp — +55 11 99999-0000');

        const credentials = JSON.parse(integration.credentials);
        expect(credentials.business_token).toBe('BUSINESS_TOKEN_TEST');

        expect(integration.metadata).toMatchObject({
            waba_id: '123456789',
            phone_number_id: '987654321',
            display_phone_number: '+55 11 99999-0000',
            verified_name: 'Loja Teste',
            quality_rating: 'GREEN',
            waba_name: 'Loja Teste'
        });
        // O código é de uso único: não pode sobrar para um segundo callback.
        expect(integration.metadata.connect_code).toBeUndefined();

        // A troca e as duas conferências acontecem no servidor, com o App Secret.
        expect(exchangeBusinessToken).toHaveBeenCalledWith('code-da-meta');
        expect(fetchWaba).toHaveBeenCalledWith('123456789', 'BUSINESS_TOKEN_TEST');
        expect(fetchPhoneNumber).toHaveBeenCalledWith('987654321', 'BUSINESS_TOKEN_TEST');
    });

});

describe('initializeChannels', () => {

    it('cria o canal whatsapp uma única vez', async () => {
        await initializeChannels();
        await initializeChannels();

        const rows = await Channel.findAll({ where: { type: 'whatsapp' } });
        expect(rows).toHaveLength(1);
        expect(rows[0].name).toBe('WhatsApp');
        expect(rows[0].icon_url).toBe('/public/images/whatsapp-logo.png');
    });

});
