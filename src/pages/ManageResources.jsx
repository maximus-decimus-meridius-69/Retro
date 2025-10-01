// src/pages/ManageResources.jsx
import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";

const instruments = [
  "drums",
  "flute",
  "guitar",
  "tabla",
  "harmonium",
  "saxophone",
  "keyboard",
  "violin",
];
const levels = ["beginner", "intermediate", "advanced"];
const types = ["video", "journal", "pdf", "course"];

const ManageResources = () => {
  const [resources, setResources] = useState([]);
  const [filteredResources, setFilteredResources] = useState([]);
  const [editingResource, setEditingResource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedInstrument, setSelectedInstrument] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");

  // Fetch all resources once
  const fetchResources = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, "resources"));
    setResources(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => {
    fetchResources();
  }, []);

  // Re-filter whenever resources or dropdowns change
  useEffect(() => {
    let list = [...resources];
    if (selectedInstrument) {
      list = list.filter(r => r.instrument === selectedInstrument);
    }
    if (selectedLevel) {
      list = list.filter(r => r.level === selectedLevel);
    }
    setFilteredResources(list);
  }, [resources, selectedInstrument, selectedLevel]);

  // Delete a resource
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this resource?")) return;
    await deleteDoc(doc(db, "resources", id));
    fetchResources();
  };

  // Start editing
  const handleEditClick = (res) => {
    setEditingResource({ ...res });
  };

  // Handle form field change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditingResource(prev => ({ ...prev, [name]: value }));
  };

  // Submit update
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const { id, title, link, instrument, level, resourceType } = editingResource;
      await updateDoc(doc(db, "resources", id), {
        title, link, instrument, level, resourceType
      });
      alert("Resource updated!");
      setEditingResource(null);
      fetchResources();
    } catch (err) {
      console.error(err);
      alert("Update failed; check console.");
    }
  };

  // Change only the resource name
  const handleChangeTitle = async (resource) => {
    const newTitle = prompt("Enter the new title for the resource:", resource.title);
    if (!newTitle || newTitle.trim() === "" || newTitle === resource.title) return;
    try {
      await updateDoc(doc(db, "resources", resource.id), {
        title: newTitle.trim()
      });
      alert("Title updated successfully!");
      fetchResources();
    } catch (err) {
      console.error("Failed to update title:", err);
      alert("Failed to update title. Check console.");
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Manage Resources</h1>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <select
          value={selectedInstrument}
          onChange={e => {
            setSelectedInstrument(e.target.value);
            setSelectedLevel("");
          }}
          className="p-2 border rounded"
        >
          <option value="">All Instruments</option>
          {instruments.map(inst => (
            <option key={inst} value={inst}>{inst}</option>
          ))}
        </select>
        <select
          value={selectedLevel}
          onChange={e => setSelectedLevel(e.target.value)}
          className="p-2 border rounded"
          disabled={!selectedInstrument}
        >
          <option value="">All Levels</option>
          {levels.map(lvl => (
            <option key={lvl} value={lvl}>{lvl}</option>
          ))}
        </select>
      </div>

      {/* Resource List */}
      {loading ? (
        <p>Loading resources…</p>
      ) : filteredResources.length === 0 ? (
        <p>No resources found.</p>
      ) : (
        <div className="space-y-4">
          {filteredResources.map(res => (
            <div
              key={res.id}
              className="p-4 border rounded flex justify-between items-start"
            >
              <div>
                <p className="font-semibold text-lg">{res.title}</p>
                <p className="text-sm text-gray-600 mb-1">
                  {res.instrument} • {res.level} • {res.resourceType}
                </p>
                <a
                  href={res.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline"
                >
                  {res.link}
                </a>
              </div>
              <div className="space-x-2">
                <button
                  onClick={() => handleEditClick(res)}
                  className="px-3 py-1 bg-yellow-500 text-white rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(res.id)}
                  className="px-3 py-1 bg-red-600 text-white rounded"
                >
                  Delete
                </button>
                <button
                  onClick={() => handleChangeTitle(res)}
                  className="px-3 py-1 bg-blue-600 text-white rounded"
                >
                  Change Name
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Form */}
      {editingResource && (
        <div className="mt-8 p-6 border rounded bg-gray-100">
          <h2 className="text-xl font-semibold mb-4">Edit Resource</h2>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <input
              name="title"
              type="text"
              placeholder="Title"
              value={editingResource.title}
              onChange={handleInputChange}
              className="w-full p-2 border rounded"
              required
            />
            <input
              name="link"
              type="url"
              placeholder="Link"
              value={editingResource.link}
              onChange={handleInputChange}
              className="w-full p-2 border rounded"
              required
            />
            <select
              name="instrument"
              value={editingResource.instrument}
              onChange={handleInputChange}
              className="w-full p-2 border rounded"
              required
            >
              {instruments.map(inst => (
                <option key={inst} value={inst}>{inst}</option>
              ))}
            </select>
            <select
              name="level"
              value={editingResource.level}
              onChange={handleInputChange}
              className="w-full p-2 border rounded"
              required
            >
              {levels.map(lvl => (
                <option key={lvl} value={lvl}>{lvl}</option>
              ))}
            </select>
            <select
              name="resourceType"
              value={editingResource.resourceType}
              onChange={handleInputChange}
              className="w-full p-2 border rounded"
              required
            >
              {types.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingResource(null)}
                className="px-4 py-2 bg-gray-500 text-white rounded"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ManageResources;
