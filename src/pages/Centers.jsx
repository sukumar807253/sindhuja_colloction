import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function Centers() {
  const [centers, setCenters] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCenters();
  }, []);

  const fetchCenters = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/centers");
      setCenters(res.data);
    } catch (err) {
      console.error("Failed to load centers", err);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Centers</h2>

      {centers.length === 0 && (
        <p className="text-gray-500">No centers found</p>
      )}

      {centers.map((c) => (
        <button
          key={c.id}
          onClick={() => navigate(`/members/${c.id}`)}
          className="block w-full text-left p-3 border rounded mb-2 hover:bg-gray-100"
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}
