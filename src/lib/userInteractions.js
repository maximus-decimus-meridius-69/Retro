// src/lib/userInteractions.js
import { getDatabase, ref, get, update, push } from "firebase/database";
import { auth } from "../firebase";

const db = getDatabase();

const path = (instrument, resourceId) =>
  `userInteractions/${auth.currentUser.uid}/${instrument}/${resourceId}`;

// Toggle a boolean field (bookmarked, upvoted, downvoted, progress)
export const toggleField = async (instrument, resourceId, field) => {
  const nodeRef = ref(db, path(instrument, resourceId));
  const snapshot = await get(nodeRef);             // ← use get()
  const data = snapshot.val() || {};
  const current = data[field] || false;
  await update(nodeRef, { [field]: !current });
};

// Add a comment under comments/
export const addComment = async (instrument, resourceId, text) => {
  const commentsRef = ref(db, `${path(instrument, resourceId)}/comments`);
  await push(commentsRef, {
    text,
    timestamp: Date.now(),
  });
};
