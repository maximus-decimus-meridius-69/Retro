import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  auth,
  getCourseById,
  enrollInCourse,
  unenrollFromCourse,
  createMeeting,
  getMeetings,
  addCourseMaterial,
  getCourseMaterials,
  deleteCourseMaterial,
} from '../firebase';
import { Calendar, Users, Video } from 'lucide-react';

const MaterialUploader = ({ onUpload }) => {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="border rounded p-3 flex items-center gap-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="flex-1 border rounded px-2 py-1"
      />
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <button
        disabled={!file || busy}
        className="px-3 py-1.5 rounded bg-purple-600 text-white disabled:bg-gray-300"
        onClick={async () => {
          if (!file) return;
          setBusy(true);
          try { await onUpload(file, title || file.name); } finally { setBusy(false); setFile(null); setTitle(''); }
        }}
      >{busy ? 'Uploading...' : 'Upload'}</button>
    </div>
  );
};

const CourseDetailPage = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const userId = auth.currentUser?.uid;
  const [course, setCourse] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMeeting, setShowMeeting] = useState(false);
  const [topic, setTopic] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const isCreator = useMemo(() => course && course.creatorId === userId, [course, userId]);
  const isEnrolled = useMemo(
    () => !!course && (course.enrolledUsers || []).includes(userId),
    [course, userId]
  );

  const load = async () => {
    setLoading(true);
    try {
      const c = await getCourseById(courseId);
      setCourse(c);
      const m = await getMeetings(courseId);
      setMeetings(m);
      const mats = await getCourseMaterials(courseId);
      setMaterials(mats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const handleEnroll = async () => {
    await enrollInCourse(courseId, userId);
    await load();
  };

  const handleUnenroll = async () => {
    await unenrollFromCourse(courseId, userId);
    await load();
  };

  const handleCreateMeeting = async () => {
    if (!topic.trim() || !scheduledTime) return;
    await createMeeting({
      courseId,
      title: topic, // Map topic to title for consistency
      scheduledTime: new Date(scheduledTime),
      hostId: userId,
      hostName: auth.currentUser?.displayName || auth.currentUser?.email,
      hostEmail: auth.currentUser?.email,
      allowedEmails: course.enrolledUsers || [],
      isActive: false,
      participants: [userId, ...(course.enrolledUsers || [])]
    });
    setShowMeeting(false);
    setTopic('');
    setScheduledTime('');
    await load();
  };

  const canAccessMaterials = isCreator || isEnrolled;

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!course) return <div className="p-8 text-center text-gray-500">Course not found</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-800">{course.title}</h1>
          <p className="text-gray-600 mt-1">{course.description}</p>
          <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
            <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {course.enrolledUsers?.length || 0} enrolled</span>
            {isCreator && <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700">You are the instructor</span>}
          </div>
          <div className="mt-4 flex gap-2">
            {!isCreator && (
              isEnrolled ? (
                <button onClick={handleUnenroll} className="px-4 py-2 rounded bg-white border hover:bg-gray-50">Unenroll</button>
              ) : (
                <button onClick={handleEnroll} className="px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700">Enroll</button>
              )
            )}
            {isCreator && (
              <button onClick={() => setShowMeeting(true)} className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Schedule Meeting
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Video className="w-5 h-5 text-purple-600" /> Meetings
          </h2>
          {meetings.length === 0 ? (
            <div className="text-gray-500">No meetings scheduled.</div>
          ) : (
            <div className="space-y-3">
              {meetings.map((m) => (
                <div key={m.id} className="p-4 border rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-800">{m.title || m.topic}</div>
                    <div className="text-sm text-gray-600">{m.scheduledTime?.toDate?.()?.toLocaleString() || new Date(m.scheduledTime).toLocaleString?.() || ''}</div>
                  </div>
                  {canAccessMaterials ? (
                    <button
                      onClick={() => navigate(`/meeting/${m.id}`)}
                      className="px-3 py-1.5 rounded bg-purple-600 text-white hover:bg-purple-700"
                    >Join</button>
                  ) : (
                    <span className="text-xs text-gray-400">Enroll to join</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Materials</h2>
          {canAccessMaterials ? (
            <div className="space-y-3">
              {isCreator && (
                <MaterialUploader
                  onUpload={async (file, title) => {
                    await addCourseMaterial(courseId, file, title, userId);
                    const mats = await getCourseMaterials(courseId);
                    setMaterials(mats);
                  }}
                />
              )}
              {materials.length === 0 ? (
                <div className="text-gray-500">No materials yet.</div>
              ) : (
                <ul className="space-y-2">
                  {materials.map((m) => (
                    <li key={m.id} className="flex items-center justify-between p-3 border rounded">
                      <a href={m.fileUrl} target="_blank" rel="noreferrer" className="text-purple-700 hover:underline">
                        {m.title || 'Material'}
                      </a>
                      {isCreator && (
                        <button
                          className="text-red-600 hover:underline"
                          onClick={async () => {
                            await deleteCourseMaterial(m.id);
                            setMaterials(await getCourseMaterials(courseId));
                          }}
                        >Delete</button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="text-gray-500">Enroll to access course materials.</div>
          )}
        </div>
      </div>

      {showMeeting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-lg">
            <div className="p-4 border-b font-semibold">Schedule Meeting</div>
            <div className="p-4 space-y-3">
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Topic"
                className="w-full border rounded px-3 py-2"
              />
              <input
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowMeeting(false)} className="px-4 py-2 rounded bg-gray-100">Cancel</button>
                <button onClick={handleCreateMeeting} className="px-4 py-2 rounded bg-purple-600 text-white">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseDetailPage;



