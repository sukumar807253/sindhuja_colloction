import { useEffect, useState } from "react";
import axios from "axios";

export default function DailyTally() {
  const [tally, setTally] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDailyTally();
  }, []);

  const fetchDailyTally = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await axios.get(
        "http://localhost:5000/api/collections/daily"
      );

      setTally(res.data || []);
    } catch (err) {
      console.error("Failed to fetch daily tally:", err);
      setError("Unable to load daily collection data");
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = tally.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0
  );

  if (loading)
    return <p className="p-6 text-gray-600">Loading daily tally...</p>;

  if (error)
    return <p className="p-6 text-red-600 font-semibold">{error}</p>;

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Daily Collection Tally</h2>

      {/* TOTAL */}
      <div className="mb-4 p-3 bg-green-100 border border-green-300 rounded font-semibold">
        Total Collected Today: ₹ {totalAmount}
      </div>

      {tally.length === 0 ? (
        <p className="text-gray-500">No collections recorded today.</p>
      ) : (
        <table className="w-full border border-gray-300">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="border p-2">Center</th>
              <th className="border p-2">Member</th>
              <th className="border p-2">Amount</th>
              <th className="border p-2">Date</th>
            </tr>
          </thead>

          <tbody>
            {tally.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="border p-2">
                  {row.center_name || "-"}
                </td>
                <td className="border p-2">
                  {row.member_name || "-"}
                </td>
                <td className="border p-2 font-semibold text-green-700">
                  ₹ {row.amount}
                </td>
                <td className="border p-2">
                  {new Date(row.paid_at).toLocaleDateString("en-IN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
