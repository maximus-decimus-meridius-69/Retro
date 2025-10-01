import { getDatabase, ref, push, onValue } from "firebase/database";
import { auth } from "../firebase";

const rtdb = getDatabase();

// Subscribe to comments for a resource
export const subscribeComments = (instrument, resourceId, callback) => {
  const commentsRef = ref(rtdb, `comments/${instrument}/${resourceId}`);
  return onValue(commentsRef, (snap) => {
    const data = snap.val() || {};
    const list = Object.entries(data).map(([id, c]) => ({ id, ...c }));
    callback(list);
  });
};

// Add a comment
export const addComment = async (instrument, resourceId, text) => {
  const user = auth.currentUser;
  const commentsRef = ref(rtdb, `comments/${instrument}/${resourceId}`);
  await push(commentsRef, {
    uid: user.uid,
    userName: user.displayName || user.email,
    text,
    timestamp: Date.now(),
  });
};
