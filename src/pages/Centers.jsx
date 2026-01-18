import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

export default function Centers() {
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const fetchCenters = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await axios.get(`${API}/centers`, {
        timeout: 15000 // handles Render cold start
      });

      setCenters(res.data || []);
    } catch (err) {
      console.error("Failed to load centers", err);
      setError("Unable to load centers. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCenters();
  }, [fetchCenters]);

  /* ================= UI ================= */
  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Centers</h2>

      {/* Loading */}
      {loading && (
        <p className="text-gray-500">Loading centers...</p>
      )}

      {/* Error */}
      {!loading && error && (
        <p className="text-red-500">{error}</p>
      )}

      {/* Empty */}
      {!loading && !error && centers.length === 0 && (
        <p className="text-gray-500">No centers found</p>
      )}

      {/* Centers */}
      {!loading && !error && centers.map(center => (
        <button
          key={center.id}
          onClick={() => navigate(`/members/${center.id}`)}
          className="block w-full text-left p-3 border rounded mb-2
                     hover:bg-gray-100 transition"
        >
          {center.name}
        </button>
      ))}
    </div>
  );
}
