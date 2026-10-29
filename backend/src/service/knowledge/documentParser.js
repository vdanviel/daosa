import { extname } from 'node:path';
import fs from 'node:fs/promises';
import mammoth from 'mammoth';
import { extractText as extractPdfText } from 'unpdf';
import { PDFDocument } from 'pdf-lib';
import { execSync } from 'node:child_process';
import * as XLSX from 'xlsx';

/**
 * Plain text extraction for knowledge sources — one parser per file extension.
 * Supporting a new format means adding an entry below (and its dependency).
 *
 * The text is returned raw on purpose: it must not go through
 * `preprocessCorpus()`, which lowercases, strips punctuation and drops repeated
 * tokens. That cleanup is fine for prompts, but it degrades embeddings and
 * makes quoted passages unreadable.
 */
export const parsers = {
	txt: (buffer) => buffer.toString('utf8'),
	md: (buffer) => buffer.toString('utf8'),
	docx: async (buffer) => {
		try {
			return (await mammoth.extractRawText({ buffer })).value;
		} catch (err) {
			if (err?.message?.includes('zip') || err?.message?.includes('central directory')) {
				throw Object.assign(new Error('DOCX corrompido (estrutura zip inválida).'), { status: 422 });
			}
			throw err;
		}
	},
	pdf: async (buffer) => {
		try {
			// Detecta AcroForm (campos editáveis) e trata antes de extrair
			let hasForm = false;
			try {
				const pdfDoc = await PDFDocument.load(buffer);
				hasForm = pdfDoc.getForm ? (() => {
					try { pdfDoc.getForm(); return true; } catch { return false; }
				})() : false;
			} catch {
				hasForm = false; // arquivo corrompido / não-PDF — deixa pro unpdf
			}

			if (hasForm) {
				// Flat via pdftotext (extração de texto com campos renderizados)
				const tmpIn = `/tmp/pdf_acro_tmp_${Date.now()}.pdf`;
				await fs.writeFile(tmpIn, buffer);
				try {
					const text = execSync(`pdftotext -layout "${tmpIn}" -`, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }).trim();
					if (text) return text;
				} finally {
					await fs.unlink(tmpIn).catch(() => {});
				}
			}

			const { text } = await extractPdfText(new Uint8Array(buffer), { mergePages: true });
			return text;
		} catch (err) {
			// Fallback final para PDFs inválidos / com estruturas complexas
			if (err?.message?.includes('Invalid PDF') || err?.name === 'InvalidPDFException') {
				try {
					const tmpIn = `/tmp/pdf_bad_tmp_${Date.now()}.pdf`;
					await fs.writeFile(tmpIn, buffer);
					try {
						const text = execSync(`pdftotext -layout "${tmpIn}" -`, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }).trim();
						if (text) return text;
					} finally {
						await fs.unlink(tmpIn).catch(() => {});
					}
				} catch { /* ignore */ }
			}
			throw err;
		}
	},
	xlsx: (buffer) => extractSheets(XLSX.read(buffer)),
	csv: (buffer) => {
		try {
			return extractSheets(XLSX.read(buffer.toString('utf8'), { type: 'string' }));
		} catch {
			return buffer.toString('utf8').trim();
		}
	}
};

/** `report.PDF` -> `pdf`. */
export function extensionOf(file_name = '') {
	return extname(file_name).slice(1).toLowerCase();
}

export function isSupported(file_name) {
	return Boolean(parsers[extensionOf(file_name)]);
}

/** One CSV block per sheet, so headers and numbers survive the split. */
function extractSheets(workbook) {
	return workbook.SheetNames
		.map((name, index) => {
			const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name], { blankrows: false });
			return csv.trim() ? `--- sheet ${index + 1} (${name}) ---\n${csv}` : '';
		})
		.filter(Boolean)
		.join('\n');
}

/**
 * Reads `file_path` and returns its text, or rejects with `status` set so the
 * RAG worker can store the message in `knowledge_source.error_message`.
 */
export async function extractText(file_path, file_extension) {
	const parser = parsers[file_extension];

	if (!parser) {
		throw Object.assign(new Error(`Unsupported file extension: ${file_extension}.`), { status: 422 });
	}

	const buffer = await fs.readFile(file_path);
	const text = (await parser(buffer)).replace(/\r\n/g, '\n').trim();

	if (!text) {
		throw Object.assign(
			new Error('No text could be extracted (empty file or scanned PDF — OCR is not supported).'),
			{ status: 422 }
		);
	}

	return text;
}
