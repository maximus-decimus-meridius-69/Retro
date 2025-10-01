import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  auth,
  createCourse,
  getCourses,
  getEnrolledCourses,
  enrollInCourse,
  unenrollFromCourse,
} from '../firebase';
import { BookOpen, PlusCircle, UserPlus, Users } from 'lucide-react';

const CoursesPage = () => {
  const navigate = useNavigate();
  const userId = auth.currentUser?.uid;
  const [tab, setTab] = useState('explore'); // explore | my | enrolled
  const [courses, setCourses] = useState([]);
  const [myCourses, setMyCourses] = useState([]);
  const [enrolled, setEnrolled] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!userId) return;
      setLoading(true);
      try {
        const [all, mine, myEnroll] = await Promise.all([
          getCourses(),
          getCourses(userId),
          getEnrolledCourses(userId),
        ]);
        setCourses(all);
        setMyCourses(mine);
        setEnrolled(myEnroll);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    const id = await createCourse({
      title,
      description,
      creatorId: userId,
    });
    setShowCreate(false);
    setTitle('');
    setDescription('');
    navigate(`/course/${id}`);
  };

  const handleEnroll = async (courseId) => {
    if (!userId) return;
    await enrollInCourse(courseId, userId);
    const updated = await getEnrolledCourses(userId);
    setEnrolled(updated);
  };

  const handleUnenroll = async (courseId) => {
    if (!userId) return;
    await unenrollFromCourse(courseId, userId);
    const updated = await getEnrolledCourses(userId);
    setEnrolled(updated);
  };

  const isEnrolled = (courseId) => enrolled.some((c) => c.id === courseId);

  const list = tab === 'explore' ? courses : tab === 'my' ? myCourses : enrolled;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-purple-600" />
            Courses
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreate(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <PlusCircle className="w-5 h-5" /> Create
            </button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-2 border-b flex gap-6">
          <button
            className={`pb-2 ${tab==='explore'?'border-b-2 border-purple-600 text-purple-600':''}`}
            onClick={() => setTab('explore')}
          >Explore</button>
          <button
            className={`pb-2 ${tab==='my'?'border-b-2 border-purple-600 text-purple-600':''}`}
            onClick={() => setTab('my')}
          >My Courses</button>
          <button
            className={`pb-2 ${tab==='enrolled'?'border-b-2 border-purple-600 text-purple-600':''}`}
            onClick={() => setTab('enrolled')}
          >Enrolled</button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading...</div>
        ) : list.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No courses</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {list.map((course) => (
              <div key={course.id} className="bg-white rounded-lg shadow p-5 flex flex-col">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800">{course.title}</h3>
                  <p className="text-gray-600 mt-1 line-clamp-3">{course.description}</p>
                  <div className="text-sm text-gray-500 mt-2 flex items-center gap-2">
                    <Users className="w-4 h-4" /> {course.enrolledUsers?.length || 0} enrolled
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => navigate(`/course/${course.id}`)}
                    className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
                  >View</button>
                  {course.creatorId === userId ? null : isEnrolled(course.id) ? (
                    <button
                      onClick={() => handleUnenroll(course.id)}
                      className="px-4 py-2 rounded bg-white border hover:bg-gray-50"
                    >Unenroll</button>
                  ) : (
                    <button
                      onClick={() => handleEnroll(course.id)}
                      className="px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-2"
                    >
                      <UserPlus className="w-4 h-4" /> Enroll
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-lg">
            <div className="p-4 border-b font-semibold">Create Course</div>
            <div className="p-4 space-y-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                className="w-full border rounded px-3 py-2"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description"
                rows={4}
                className="w-full border rounded px-3 py-2"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded bg-gray-100">Cancel</button>
                <button onClick={handleCreate} className="px-4 py-2 rounded bg-purple-600 text-white">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoursesPage;



