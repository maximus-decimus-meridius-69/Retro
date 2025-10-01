import React, { useState, useEffect } from "react";
import { ref, onValue, push } from "firebase/database";
import { rtdb, auth } from "../firebase";

const CommentSection = ({ resourceId }) => {
  const [show, setShow] = useState(false);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);

  useEffect(() => {
    if (show) {
      const commentsRef = ref(rtdb, `comments/${resourceId}`);
      onValue(commentsRef, (snapshot) => {
        const data = snapshot.val();
        const all = data ? Object.values(data) : [];
        setComments(all);
      });
    }
  }, [show, resourceId]);

  const handleComment = async () => {
    if (comment.trim()) {
      const newComment = {
        message: comment,
        user: auth.currentUser.displayName || auth.currentUser.email,
        timestamp: Date.now()
      };
      await push(ref(rtdb, `comments/${resourceId}`), newComment);
      setComment("");
    }
  };

  return (
    <div>
      <button onClick={() => setShow(prev => !prev)} className="ml-2 text-sm text-gray-500 hover:text-gray-800">
        💬 Comments
      </button>
      {show && (
        <div className="mt-2 ml-4 border-l pl-4">
          <div>
            {comments.map((c, idx) => (
              <p key={idx}>
                <strong>{c.user}</strong>: {c.message}
              </p>
            ))}
          </div>
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Write a comment..."
            className="border p-1 mt-2 w-full"
          />
          <button onClick={handleComment} className="text-sm mt-1 bg-blue-500 text-white px-2 py-1 rounded">
            Post
          </button>
        </div>
      )}
    </div>
  );
};

export default CommentSection;
