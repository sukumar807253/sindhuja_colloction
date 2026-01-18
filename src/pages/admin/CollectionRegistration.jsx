import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:5000/api";

export default function CollectionRegistration() {
  const [centers, setCenters] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedCenter, setSelectedCenter] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [commonDate, setCommonDate] = useState("");
  const [loading, setLoading] = useState(false);

  /* ================= FETCH CENTERS ================= */
  useEffect(() => {
    const fetchCenters = async () => {
      try {
        const res = await axios.get(`${API}/centers`);
        setCenters(res.data);
      } catch (err) {
        console.error(err);
        alert("Failed to load centers ❌");
      }
    };
    fetchCenters();
  }, []);

  /* ================= SHOW MEMBERS ================= */
  const handleShowMembers = async (center) => {
    const stored = localStorage.getItem(`collection_${center.id}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      setMembers(parsed.members);
      setCommonDate(parsed.commonDate);
    } else {
      try {
        const res = await axios.get(`${API}/members/${center.id}`);
        // Map members with loanId included
        const initialMembers = res.data.map((m) => ({
          name: m.name,
          loanId: m.loan_id, // ensure loanId is set
          schedule: []
        }));
        setMembers(initialMembers);
        setCommonDate("");
      } catch (err) {
        console.error(err);
        alert("Failed to load members ❌");
        return;
      }
    }
    setSelectedCenter(center);
    setShowModal(true);
  };

  /* ================= GENERATE STABLE SCHEDULE ================= */
  const handleGenerateAll = () => {
    if (!commonDate) {
      alert("Select first collection date");
      return;
    }

    // 12-week amounts
    const weeklyAmounts = [
      1100, 1100, 1100, 1100,
      1080, 1080, 1080, 1080,
      1070, 1070, 1070, 1070
    ];

    const generatedMembers = members.map((m) => {
      let date = new Date(commonDate);

      const schedule = weeklyAmounts.map((amt, i) => {
        const row = {
          week_no: i + 1,
          collection_date: date.toISOString().split("T")[0],
          expected_amount: amt,
          amount_due: amt
        };
        date.setDate(date.getDate() + 7); // next week
        return row;
      });

      return { ...m, schedule };
    });

    setMembers(generatedMembers);

    // Save to localStorage to remain stable if modal is reopened
    localStorage.setItem(
      `collection_${selectedCenter.id}`,
      JSON.stringify({ commonDate, members: generatedMembers })
    );
  };

  /* ================= CLEAR SCHEDULE ================= */
  const handleClearSchedules = () => {
    if (!window.confirm("Clear all generated schedules?")) return;

    const cleared = members.map((m) => ({ ...m, schedule: [] }));
    setMembers(cleared);
    setCommonDate("");

    localStorage.removeItem(`collection_${selectedCenter.id}`);
  };

  /* ================= SAVE ALL ================= */
  const handleSaveAll = async () => {
    // Flatten schedules, keeping loanId with each entry
    const rows = members.flatMap((m) =>
      m.schedule.map((s) => ({
        loan_id: m.loanId,
        week_no: s.week_no,
        collection_date: s.collection_date,
        expected_amount: s.expected_amount,
        amount_due: s.amount_due,
        status: "pending"
      }))
    );

    if (rows.length === 0) {
      alert("No schedules generated ❌");
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${API}/collections/schedule`, { rows });
      alert("Schedules saved successfully ✅");
      setShowModal(false);
      setMembers([]);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Failed to save schedule ❌");
    } finally {
      setLoading(false);
    }
  };

  /* ================= UI ================= */
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Collection Schedule</h2>

      {/* ===== CENTER TABLE ===== */}
      <table className="w-full border border-gray-300 rounded">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-4 py-2">S.No</th>
            <th className="border px-4 py-2">Center Name</th>
            <th className="border px-4 py-2 text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          {centers.map((c, i) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <td className="border px-4 py-2">{i + 1}</td>
              <td className="border px-4 py-2">{c.name}</td>
              <td className="border px-4 py-2 text-center">
                <button
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded"
                  onClick={() => handleShowMembers(c)}
                >
                  Open
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ===== MODAL ===== */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white p-5 w-[90%] max-w-4xl rounded">
            <h3 className="text-lg font-semibold mb-4">{selectedCenter?.name}</h3>

            {/* COMMON DATE & ACTIONS */}
            <div className="flex items-center gap-3 mb-4">
              <label className="font-medium">First Collection Date:</label>
              <input
                type="date"
                className="border px-3 py-1 rounded"
                value={commonDate}
                onChange={(e) => setCommonDate(e.target.value)}
              />
              <button
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded"
                onClick={handleGenerateAll}
              >
                Generate All
              </button>
              <button
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-1 rounded"
                onClick={handleClearSchedules}
              >
                Clear
              </button>
            </div>

            {/* MEMBER TABLE */}
            <table className="w-full border border-gray-300 rounded-md overflow-hidden">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-4 py-2 text-left">Member Name</th>
                  <th className="border px-4 py-2 text-center">First Collection Date</th>
                  <th className="border px-4 py-2 text-center">Status</th>
                  <th className="border px-4 py-2 text-center">Loan ID</th>
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="border px-4 py-6 text-center text-gray-500">
                      No Members Found
                    </td>
                  </tr>
                ) : (
                  members.map((m) => (
                    <tr key={m.loanId} className="hover:bg-gray-50">
                      <td className="border px-4 py-2 font-medium">{m.name}</td>
                      <td className="border px-4 py-2 text-center">
                        {m.schedule.length > 0 ? m.schedule[0].collection_date : "-"}
                      </td>
                      <td className="border px-4 py-2 text-center">
                        {m.schedule.length > 0 ? (
                          <span className="text-green-600 font-semibold">✓ Generated</span>
                        ) : (
                          <span className="text-red-500 font-medium">Pending</span>
                        )}
                      </td>
                      <td className="border px-4 py-2 text-center">{m.loanId}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* SAVE ACTIONS */}
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="bg-gray-400 text-white px-4 py-2 rounded"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded"
                onClick={handleSaveAll}
                disabled={loading}
              >
                {loading ? "Saving..." : "Save All"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
