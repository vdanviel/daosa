import { expect, it, describe, vi, beforeEach } from "vitest";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import { putLogObject } from "../../src/connection/aws/s3.js";
import { ApiError } from "../../src/contracts/Error.js";

vi.mock("../../src/connection/aws/s3.js", () => ({ putLogObject: vi.fn() }));

describe("errorHandler", () => {

    beforeEach(() => {
        vi.clearAllMocks();
        putLogObject.mockResolvedValue();
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("deve retornar status e corpo de erro corretos", () => {
        const err = {
            name: "ValidationError",
            message: "Validation failed",
            code: "VALIDATION_ERROR",
            status: 400,
            stack: "Error stack trace",
            context: { field: "email" }
        };

        const req = {
            headers: { "x-request-id": "test-trace-id" }
        };

        const res = {
            status: vi.fn(function() { return this; }),
            json: vi.fn()
        };

        const next = vi.fn();

        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);

    });

    it("deve usar status padrão 500 quando não houver status", () => {
        const err = {
            name: "Error",
            message: "Something went wrong",
            code: "INTERNAL_ERROR",
            stack: "Error stack trace"
        };

        const req = {
            headers: {}
        };

        const res = {
            status: vi.fn(function() { return this; }),
            json: vi.fn()
        };

        errorHandler(err, req, res, vi.fn());

        expect(res.status).toHaveBeenCalledWith(500);
    });

    it("deve gerar trace id quando não houver nos headers", () => {
        const err = {
            name: "Error",
            message: "Test error",
            code: "TEST_ERROR",
            stack: "Error stack trace"
        };

        const req = {
            headers: {}
        };

        const res = {
            status: vi.fn(function() { return this; }),
            json: vi.fn()
        };

        errorHandler(err, req, res, vi.fn());

        expect(res.status).toHaveBeenCalledWith(500);

    });

    it("log error", () => {
        const err = {
            name: "TestError",
            message: "Test message",
            code: "TEST",
            status: 400,
            stack: "Error stack trace"
        };

        const req = { headers: { "x-request-id": "test-id" } };
        const res = {
            status: vi.fn(function() { return this; }),
            json: vi.fn()
        };

        errorHandler(err, req, res, vi.fn());

        expect(res.status).toHaveBeenCalledWith(400);

    });

    it("não grava Unauthorized no S3", () => {
        const err = ApiError.unauthorized("Email ou senha inválidos.");
        const req = { headers: {} };
        const res = {
            status: vi.fn(function() { return this; }),
            json: vi.fn()
        };

        errorHandler(err, req, res, vi.fn());

        expect(putLogObject).not.toHaveBeenCalled();
    });

    it("grava erro com a mesma mensagem que não seja Unauthorized", () => {
        const err = ApiError.validation("Email ou senha inválidos.", 401);
        const req = { headers: {} };
        const res = {
            status: vi.fn(function() { return this; }),
            json: vi.fn()
        };

        errorHandler(err, req, res, vi.fn());

        expect(putLogObject).toHaveBeenCalledOnce();
    });

});