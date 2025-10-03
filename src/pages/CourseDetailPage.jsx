import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  auth,
  getCourseById,
  enrollInCourse,
  unenrollFromCourse,
} from '../firebase';
import { Users } from 'lucide-react';
import CourseMeetingScheduler from '../components/CourseMeetingScheduler';

const CourseDetailPage = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const userId = auth.currentUser?.uid;
  const userEmail = auth.currentUser?.email;
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
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

  const canAccessMaterials = isCreator || isEnrolled;

  // Get enrolled emails for the meeting scheduler
  const getEnrolledEmails = () => {
    if (!course || !course.enrolledUsers) return [];
    // This is a simplified version - in production, you'd fetch actual emails from user profiles
    return course.enrolledUsers.map(uid => `user-${uid}@email.com`);
  };

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
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Meeting Scheduler Component */}
        {canAccessMaterials && (
          <CourseMeetingScheduler
            courseId={courseId}
            courseTitle={course.title}
            enrolledEmails={getEnrolledEmails()}
            isHost={isCreator}
          />
        )}
      </div>
    </div>
  );
};

export default CourseDetailPage;



