const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { supabase } = require("./supabaseClient");
const collectionRouter = require("./routes/collectionRoutes");

const app = express();

/* ================= GLOBAL MIDDLEWARE ================= */
app.use(
  cors({
    origin: [
      "https://sindhuja-colloction.vercel.app", // Production frontend
      "http://localhost:5173"                  // Local development
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);

app.use(express.json());

/* ================= HEALTH CHECK ================= */
app.get("/", (req, res) => {
  res.json({ status: "API running ✅" });
});

/* ================= LOGIN ================= */
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Missing email or password" });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("id, name, password, isAdmin, blocked")
      .eq("email", email.toLowerCase())
      .single();

    if (error || !user) {
      return res.status(401).json({ message: "Invalid login credentials" });
    }

    if (user.blocked) {
      return res.status(403).json({ message: "Account blocked" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: "Wrong password" });
    }

    res.json({
      id: user.id,
      name: user.name,
      isAdmin: user.isAdmin
    });
  } catch (err) {
    console.error("LOGIN ERROR 👉", err);
    res.status(500).json({ message: "Login failed" });
  }
});

/* ================= CENTERS ================= */
app.get("/api/centers", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("centers")
      .select("id, name")
      .order("name");

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("CENTERS ERROR 👉", err);
    res.status(500).json({ message: "Failed to fetch centers" });
  }
});

/* ================= MEMBERS ================= */
app.get("/api/members/:centerId", async (req, res) => {
  try {
    const { centerId } = req.params;

    const { data, error } = await supabase
      .from("members")
      .select(`
        id,
        name,
        loans (
          id,
          status
        )
      `)
      .eq("center_id", centerId);

    if (error) throw error;

    const result = data
      .filter(
        m =>
          m.loans &&
          m.loans.some(l => l.status === "CREDITED")
      )
      .map(m => {
        const loan = m.loans.find(l => l.status === "CREDITED");
        return {
          member_id: m.id,
          name: m.name,
          loan_id: loan.id,
          status: loan.status
        };
      });

    res.json(result);
  } catch (err) {
    console.error("MEMBERS ERROR 👉", err);
    res.status(500).json({ message: "Failed to fetch members" });
  }
});

/* ================= COLLECTION ROUTES ================= */
app.use("/api/collections", collectionRouter);

/* ================= SERVER START ================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
