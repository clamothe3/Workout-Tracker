const { neon } = require("@neondatabase/serverless");
const jwt = require("jsonwebtoken");

const auth = (req) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return null;
  try { return jwt.verify(token, process.env.JWT_SECRET || "secret123"); }
  catch { return null; }
};

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const sql = neon(process.env.DATABASE_URL);
    const user = auth(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    await sql`CREATE TABLE IF NOT EXISTS workouts (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, name TEXT NOT NULL, date TEXT NOT NULL, notes TEXT DEFAULT '', muscle_group TEXT DEFAULT 'other')`;
    await sql`CREATE TABLE IF NOT EXISTS exercises (id SERIAL PRIMARY KEY, workout_id INTEGER NOT NULL, name TEXT NOT NULL, sets INTEGER NOT NULL, reps INTEGER NOT NULL, weight REAL DEFAULT 0)`;

    if (req.method === "GET") {
      const workouts = await sql`SELECT * FROM workouts WHERE user_id = ${user.id} ORDER BY date DESC`;
      const result = await Promise.all(workouts.map(async w => ({
        ...w,
        exercises: await sql`SELECT * FROM exercises WHERE workout_id = ${w.id}`
      })));
      return res.json(result);
    }

    if (req.method === "POST") {
      const { name, date, notes, muscle_group, exercises } = req.body;
      if (!name || !date) return res.status(400).json({ error: "Name and date required" });
      const workout = await sql`INSERT INTO workouts (user_id, name, date, notes, muscle_group) VALUES (${user.id}, ${name}, ${date}, ${notes || ""}, ${muscle_group || "other"}) RETURNING id`;
      const workoutId = workout[0].id;
      if (exercises?.length) {
        for (const e of exercises) {
          await sql`INSERT INTO exercises (workout_id, name, sets, reps, weight) VALUES (${workoutId}, ${e.name}, ${e.sets}, ${e.reps}, ${e.weight || 0})`;
        }
      }
      return res.json({ id: workoutId, message: "Workout created" });
    }

    if (req.method === "DELETE") {
      const id = req.query.id;
      const workout = await sql`SELECT * FROM workouts WHERE id = ${id} AND user_id = ${user.id}`;
      if (!workout.length) return res.status(404).json({ error: "Not found" });
      await sql`DELETE FROM exercises WHERE workout_id = ${id}`;
      await sql`DELETE FROM workouts WHERE id = ${id}`;
      return res.json({ message: "Deleted" });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};