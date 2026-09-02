import { HttpError } from "./auth.js";

// Column order shared by INSERT and UPDATE; keep in sync with schema.sql.
const ENTRY_COLUMNS = [
	"date",
	"bean_name",
	"roaster",
	"roast_date",
	"grind",
	"dose",
	"water",
	"ratio",
	"temperature",
	"brew_method",
	"brew_time",
	"equipment",
	"taste_notes",
	"rating",
	"notes",
];

const COLUMN_TO_KEY = {
	date: "date",
	bean_name: "beanName",
	roaster: "roaster",
	roast_date: "roastDate",
	grind: "grind",
	dose: "dose",
	water: "water",
	ratio: "ratio",
	temperature: "temperature",
	brew_method: "brewMethod",
	brew_time: "brewTime",
	equipment: "equipment",
	taste_notes: "tasteNotes",
	rating: "rating",
	notes: "notes",
};

// Field length caps so a hostile client cannot store megabytes per row.
const MAX_SHORT_TEXT = 200;
const MAX_NOTES = 5000;

function toNumber(value) {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

function text(value, max) {
	return String(value || "")
		.trim()
		.slice(0, max);
}

// Coerces an untrusted client payload into the exact shape of a brews row:
// strings are trimmed and capped, numeric fields are forced to finite numbers.
export function sanitizeEntry(body) {
	return {
		date: text(body.date, 10),
		beanName: text(body.beanName, MAX_SHORT_TEXT),
		roaster: text(body.roaster, MAX_SHORT_TEXT),
		roastDate: text(body.roastDate, 10),
		grind: text(body.grind, MAX_SHORT_TEXT),
		dose: toNumber(body.dose),
		water: toNumber(body.water),
		ratio: toNumber(body.ratio),
		temperature: toNumber(body.temperature),
		brewMethod: text(body.brewMethod, MAX_SHORT_TEXT),
		brewTime: Math.trunc(toNumber(body.brewTime)),
		equipment: text(body.equipment, MAX_SHORT_TEXT),
		tasteNotes: text(body.tasteNotes, MAX_SHORT_TEXT),
		rating: Math.trunc(toNumber(body.rating)),
		notes: text(body.notes, MAX_NOTES),
	};
}

export function assertEntryValid(entry) {
	if (!entry.date || !entry.beanName || !entry.brewMethod) {
		throw new HttpError(400, "Datum, bönans namn och bryggmetod krävs");
	}
}

// Bind values for the ENTRY_COLUMNS order above.
export function entryValues(entry) {
	return ENTRY_COLUMNS.map((column) => entry[COLUMN_TO_KEY[column]]);
}

export const INSERT_SQL = `INSERT INTO brews (id, user_id, ${ENTRY_COLUMNS.join(", ")}, created_at)
	VALUES (?, ?, ${ENTRY_COLUMNS.map(() => "?").join(", ")}, ?)`;

export const UPDATE_SQL = `UPDATE brews SET ${ENTRY_COLUMNS.map((c) => `${c}=?`).join(", ")}
	WHERE id=? AND user_id=?`;

// DB rows are snake_case; the client expects camelCase.
export function toEntry(row) {
	const entry = { id: row.id, userId: row.user_id, createdAt: row.created_at };
	for (const column of ENTRY_COLUMNS) {
		entry[COLUMN_TO_KEY[column]] = row[column];
	}
	return entry;
}
