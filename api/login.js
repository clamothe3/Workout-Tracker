const { neon } = require("@neondatabase/serverless");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  try {
    const sql = neon(process.env.DATABASE_URL);
    const { username, password } = req.body;
    const users = await sql`SELECT * FROM users WHERE username = ${username}`;
    const user = users[0];
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ id: user.id, username }, process.env.JWT_SECRET || "secret123");
    res.json({ token, username });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};