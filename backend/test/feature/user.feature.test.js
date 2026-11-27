import { describe, it, expect } from 'vitest';
import request from "supertest";
import { app } from "../setup/testIndex.js";

describe('/v1/user/register', () => {

  it('create user', async () => {

    const response = await request(app).post("/v1/user/register")
    .send({
        name: "Test test",
        document: "49870320821",
        email: "victordn.araujo@gmail.com",
        password: "password"
    })
    .set("Content-type", "application/json");

    expect(response.status).toBe(201);

  });


});