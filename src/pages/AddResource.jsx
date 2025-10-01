// src/pages/AddResource.jsx
import React, { useState } from "react";
import { storage, db } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc } from "firebase/firestore";

const instruments = [
  "drums", "flute", "guitar", "tabla",
  "harmonium", "saxophone", "keyboard", "violin"
];
const resourceTypes = ["video", "journal", "pdf", "course"];
const levels = ["beginner", "intermediate", "advanced"];

export default function AddResource() {
  const [instrument, setInstrument] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [level, setLevel] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [link, setLink] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    // Validate
    if (!instrument || !resourceType || !level || !title) {
      setMessage("Please fill in all fields.");
      return;
    }
    if (!file && !link) {
      setMessage("Please upload a file or provide a link.");
      return;
    }

    setUploading(true);

    try {
      let finalLink = link;

      // If a file was chosen, upload it and get its URL
      if (file) {
        const storageRef = ref(
          storage,
          `resources/${instrument}/${level}/${Date.now()}_${file.name}`
        );
        await uploadBytes(storageRef, file);
        finalLink = await getDownloadURL(storageRef);
      }

      // Add document to Firestore
      await addDoc(collection(db, "resources"), {
        instrument,
        resourceType,
        level,
        title,
        link: finalLink
      });

      setMessage("Resource added successfully!");
      // Reset form
      setInstrument("");
      setResourceType("");
      setLevel("");
      setTitle("");
      setFile(null);
      setLink("");
    } catch (err) {
      console.error(err);
      setMessage("Failed to add resource.");
    }

    setUploading(false);
  };

  return (
    <div className="p-6 max-w-lg mx-auto bg-white shadow rounded">
      <h2 className="text-2xl font-bold mb-4">Add New Resource</h2>
      {message && (
        <p className={`mb-4 ${message.includes("success") ? "text-green-600" : "text-red-600"}`}>
          {message}
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <select
          value={instrument}
          onChange={(e) => setInstrument(e.target.value)}
          className="w-full p-2 border rounded"
          required
        >
          <option value="">Select Instrument</option>
          {instruments.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>

        <select
          value={resourceType}
          onChange={(e) => setResourceType(e.target.value)}
          className="w-full p-2 border rounded"
          required
        >
          <option value="">Select Resource Type</option>
          {resourceTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="w-full p-2 border rounded"
          required
        >
          <option value="">Select Level</option>
          {levels.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />

        <div>
          <label className="block mb-1 font-medium">Upload File (optional):</label>
          <input
            type="file"
            onChange={(e) => {
              setFile(e.target.files[0]);
              setLink("");
            }}
            className="w-full"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Or Paste External Link:</label>
          <input
            type="url"
            placeholder="https://example.com/resource"
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setFile(null);
            }}
            className="w-full p-2 border rounded"
          />
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
        >
          {uploading ? "Uploading..." : "Add Resource"}
        </button>
      </form>
    </div>
  );
}
