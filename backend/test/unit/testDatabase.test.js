import { expect, it, describe } from "vitest";
import { sequelize } from "../../src/connection/database.js";

describe('testDatabase.config', () => {

    it('nome de banco de dados', () => {

        expect(sequelize.config.database).toBeTypeOf("string");

    });

    it('host do banco de dados', () => {

        expect(sequelize.config.host).toBeTypeOf("string");

    });

    it('porta de banco de dados', () => {

        expect(sequelize.config.port).toBeTypeOf("number");

    });

    it('dialeto de banco de dados', () => {

        expect(sequelize.config.dialectModule).toBeTypeOf("object");

    });
    

})
