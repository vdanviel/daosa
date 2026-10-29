import multer from "multer";
import { randomUUID } from "node:crypto";
import { extname, join } from "node:path";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { isSupported, parsers } from "../service/knowledge/documentParser.js";
import Env from "../util/Env.js";

const tempDir = join(tmpdir(), 'daosa-knowledge');

mkdirSync(tempDir, { recursive: true });

export const uploadKnowledge = multer({

  storage: multer.diskStorage({
    destination: tempDir,
    filename: (req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`)
  }),

  limits: { fileSize: Env.getUploadFileSizeLimit() * 1024 * 1024, files: 10 },

  fileFilter: (req, file, cb) => {
    if (!isSupported(file.originalname)) {
      return cb(Object.assign(
        new Error(`Unsupported file type. Allowed: ${Object.keys(parsers).join(', ')}.`),
        { status: 415 }
      ));
    }
    cb(null, true);
  }
  
});