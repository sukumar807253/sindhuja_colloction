const express = require("express");
const router = express.Router();
const { supabase } = require("../supabaseClient");

/* =====================================================
   FETCH MEMBERS WITH WEEKLY AMOUNT (FOR UI)
   GET /api/collections/members/:centerId
===================================================== */
router.get("/members/:centerId", async (req, res) => {
  try {
    const { centerId } = req.params;

    // 1️⃣ Fetch members with loans
    const { data: members, error } = await supabase
      .from("members")
      .select(`
        id,
        name,
        loans!inner (
          id
        )
      `)
      .eq("center_id", centerId);

    if (error) throw error;

    const result = [];

    // 2️⃣ For each member → get next pending week
    for (const m of members) {
      const loanId = m.loans[0]?.id;
      if (!loanId) continue;

      const { data: nextWeek } = await supabase
        .from("collection_schedule")
        .select("expected_amount, week_no")
        .eq("loan_id", loanId)
        .eq("status", "pending")
        .order("week_no", { ascending: true })
        .limit(1)
        .single();

      result.push({
        member_id: m.id,
        loan_id: loanId,
        name: m.name,
        weekly_amount: Number(nextWeek?.expected_amount || 0),
        week_no: nextWeek?.week_no || null
      });
    }

    res.json(result);
  } catch (err) {
    console.error("SUPABASE ERROR 👉", err);
    res.status(500).json({ message: "Failed to fetch weekly amount" });
  }
});

/* =====================================================
   AUTO CREATE WEEKLY COLLECTION SCHEDULE
   POST /api/collections/schedule
===================================================== */
router.post("/schedule", async (req, res) => {
  try {
    const { rows } = req.body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: "No schedule rows provided" });
    }

    const { error } = await supabase
      .from("collection_schedule")
      .insert(rows);

    if (error) {
      console.error("SUPABASE INSERT ERROR 👉", error);
      return res.status(500).json({ message: "Failed to save schedule" });
    }

    res.json({ message: "Collection schedule saved successfully ✅" });
  } catch (err) {
    console.error("SERVER ERROR 👉", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =====================================================
   PAY WEEKLY COLLECTION (BATCH)
   POST /api/collections/pay-batch
===================================================== */
router.post("/pay-batch", async (req, res) => {
  try {
    const { collection, denomination } = req.body;

    if (!collection?.length) {
      return res.status(400).json({ message: "No collection data provided" });
    }

    // Optional: validate denomination totals
    const totalCollection = collection.reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const totalNotes = denomination
      ? Object.entries(denomination).reduce((sum, [note, count]) => sum + Number(note) * Number(count), 0)
      : totalCollection;

    if (totalNotes !== totalCollection) {
      return res.status(400).json({
        message: `Denomination total mismatch: ${totalNotes} vs ${totalCollection}`,
      });
    }

    // Loop through each member payment
    for (const item of collection) {
      const { member_id, amount } = item;
      if (!member_id || amount == null) continue;

      // Fetch member loans
      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select("loans!inner(id)")
        .eq("id", member_id)
        .maybeSingle(); // use maybeSingle to avoid crash if no row

      if (memberError) {
        console.warn(`Member fetch error for ID ${member_id}:`, memberError.message);
        continue;
      }

      const loanId = memberData?.loans?.[0]?.id;
      if (!loanId) {
        console.warn(`No loan found for member ${member_id}`);
        continue;
      }

      // Get next pending week
      const { data: nextWeek, error: weekError } = await supabase
        .from("collection_schedule")
        .select("id")
        .eq("loan_id", loanId)
        .eq("status", "pending")
        .order("week_no", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (weekError) {
        console.warn(`Error fetching pending week for loan ${loanId}:`, weekError.message);
        continue;
      }

      if (!nextWeek) {
        console.warn(`No pending week found for loan ${loanId}`);
        continue;
      }

      // Update payment
      const { error: updateError } = await supabase
        .from("collection_schedule")
        .update({
          paid_amount: amount,
          status: "paid",
        })
        .eq("id", nextWeek.id);

      if (updateError) {
        console.warn(`Failed to update collection for schedule ${nextWeek.id}:`, updateError.message);
        continue;
      }
    }

    // Optionally, save denominations if provided
    if (denomination) {
      const { error: denomError } = await supabase.from("denominations").insert([{ notes: denomination }]);
      if (denomError) console.warn("Failed to save denominations:", denomError.message);
    }

    res.json({ message: "Collection saved successfully ✅" });
  } catch (err) {
    console.error("SERVER ERROR 👉", err);
    res.status(500).json({ message: "Payment failed" });
  }
});

// backend/routes/collectionRoutes.js

router.get("/daily", async (req, res) => {
  try {
    // Indian date (today)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayDate = `${yyyy}-${mm}-${dd}`;

    console.log("Fetching daily collections for:", todayDate);

    const { data, error } = await supabase
      .from("collection_schedule")
      .select(`
        paid_amount,
        collection_date,
        loans (
          members (
            name,
            centers (name)
          )
        )
      `)
      .eq("collection_date", todayDate)
      .eq("status", "paid");

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ message: error.message });
    }

    // Map DB → Frontend format
    const result = data.map(row => ({
      center_name: row.loans?.members?.centers?.name || "",
      member_name: row.loans?.members?.name || "",
      amount: row.paid_amount,
      paid_at: row.collection_date
    }));

    res.json(result);
  } catch (err) {
    console.error("SERVER ERROR 👉", err);
    res.status(500).json({ message: "Server error" });
  }
});
router.get("/unpaid-mobile", async (req, res) => {
  try {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayDate = `${yyyy}-${mm}-${dd}`;

    // 1️⃣ Fetch all today’s collections
    const { data, error } = await supabase
      .from("collection_schedule")
      .select(`
        id,
        expected_amount,
        paid_amount,
        loans (
          member:members (
            name,
            mobile,
            center:centers (
              name
            )
          )
        )
      `)
      .eq("collection_date", todayDate);

    if (error) throw error;

    // 2️⃣ Filter unpaid/partially paid in JS
    const result = data
      .filter(s => (s.paid_amount || 0) < (s.expected_amount || 0))
      .map(s => ({
        schedule_id: s.id,
        center_name: s.loans.member.center.name,
        member_name: s.loans.member.name,
        mobile: s.loans.member.mobile,
        expected_amount: s.expected_amount,
        paid_amount: s.paid_amount || 0,
        amount_due: (s.expected_amount || 0) - (s.paid_amount || 0)
      }));

    res.json(result);
  } catch (err) {
    console.error("UNPAID MOBILE ERROR 👉", err);
    res.status(500).json({ message: "Failed to fetch unpaid members" });
  }
});

// routes/collections.js
router.delete("/schedule/:centerId", async (req, res) => {
  const { centerId } = req.params;

  try {
    // Get all loan_ids for this center
    const [loans] = await db.query(
      "SELECT loan_id FROM loans WHERE center_id = ?",
      [centerId]
    );

    if (!loans.length) {
      return res.status(200).json({ message: "No schedules found" });
    }

    const loanIds = loans.map(l => l.loan_id);

    // Delete schedules
    await db.query(
      "DELETE FROM collections WHERE loan_id IN (?)",
      [loanIds]
    );

    res.json({ message: "Schedules deleted successfully ✅" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete schedules" });
  }
});


module.exports = router;
