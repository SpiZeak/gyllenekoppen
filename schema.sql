CREATE TABLE IF NOT EXISTS brews (
	id TEXT PRIMARY KEY,
	date TEXT NOT NULL,
	bean_name TEXT NOT NULL,
	roaster TEXT DEFAULT '',
	roast_date TEXT DEFAULT '',
	grind TEXT DEFAULT '',
	dose REAL DEFAULT 0,
	water REAL DEFAULT 0,
	ratio REAL DEFAULT 0,
	temperature REAL DEFAULT 0,
	brew_method TEXT NOT NULL,
	brew_time INTEGER DEFAULT 0,
	equipment TEXT DEFAULT '',
	taste_notes TEXT DEFAULT '',
	rating INTEGER DEFAULT 0,
	notes TEXT DEFAULT '',
	created_at INTEGER NOT NULL
);
