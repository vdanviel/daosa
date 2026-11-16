import { describe, it, expect } from 'vitest';
import request from "supertest";
import { testUser, validJWTUser } from "../helper/http.js";
import { Agent } from '../../src/model/agent.js';
import { Channel } from '../../src/model/channel.js';
import { app } from "../setup/testIndex.js";

describe('/v1/agent/register', () => {

  it('create agent', async () => {

    const user = await testUser();
    const channel = await Channel.findOne({ where: { type: 'own' } });

    expect(channel).not.toBeNull();

    const agent = await Agent.create({
      user_id: user.id,
      channel_id: channel.id,
      name: `Agente teste ${Date.now()}`,
      description: 'Agente usado nos testes automatizados',
      objective: 'Ajudar nos testes',
      status: 'active'
    });

    expect(agent.id).toBeDefined();
    expect(agent.user_id).toBe(user.id);
    expect(agent.channel_id).toBe(channel.id);

    const jwt = await validJWTUser()
    const response = await request(app)
    .post('/v1/agent/register')
    .set('Authorization', `Bearer ${jwt}`)
    .send({
      name: `Agente x ${Date.now()}`,
      channel_id: channel.id,
      description: "super-description",
      objective: "super-objective"
    });

    expect(response.status).toBe(201);

  });

  
});