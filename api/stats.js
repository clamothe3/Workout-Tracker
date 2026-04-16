const { neon } = require("@neondatabase/serverless");
const jwt = require("jsonwebtoken");

const auth = (req) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return null;
  try { return jwt.verify(token, process.env.JWT_SECRET || "secret123"); }
  catch { return null; }
};

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).end();
  const sql = neon(process.env.DATABASE_URL);
  const user = auth(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const totalWorkouts = await sql`SELECT COUNT(*) as count FROM workouts WHERE user_id = ${user.id}`;
  const totalExercises = await sql`SELECT COUNT(*) as count FROM exercises e JOIN workouts w ON e.workout_id = w.id WHERE w.user_id = ${user.id}`;
  const recentWorkout = await sql`SELECT * FROM workouts WHERE user_id = ${user.id} ORDER BY date DESC LIMIT 1`;
  const muscleGroups = await sql`SELECT muscle_group, COUNT(*) as count FROM workouts WHERE user_id = ${user.id} GROUP BY muscle_group`;
  const prs = await sql`SELECT e.name, MAX(e.weight) as max_weight FROM exercises e JOIN workouts w ON e.workout_id = w.id WHERE w.user_id = ${user.id} AND e.weight > 0 GROUP BY e.name ORDER BY max_weight DESC LIMIT 5`;

  res.json({
    totalWorkouts: parseInt(totalWorkouts[0].count),
    totalExercises: parseInt(totalExercises[0].count),
    recentWorkout: recentWorkout[0] || null,
    muscleGroups,
    prs
  });
};