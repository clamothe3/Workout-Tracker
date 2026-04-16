const { neon } = require("@neondatabase/serverless");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const sql = neon(process.env.DATABASE_URL);
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "All fields required" });

  try {
    await sql`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL)`;
    const existing = await sql`SELECT id FROM users WHERE username = ${username}`;
    if (existing.length) return res.status(400).json({ error: "Username already taken" });
    const hash = bcrypt.hashSync(password, 10);
    const result = await sql`INSERT INTO users (username, password) VALUES (${username}, ${hash}) RETURNING id`;
    const token = jwt.sign({ id: result[0].id, username }, process.env.JWT_SECRET || "secret123");
    res.json({ token, username });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};