import React, { useState, useEffect } from 'react';
import { auth, db, createMeeting, getMeetings, getCourses } from '../firebase';
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';

const FirebaseTestPage = () => {
  const [testResults, setTestResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const currentUser = auth.currentUser;

  const addResult = (test, success, message, data = null) => {
    setTestResults(prev => [...prev, { test, success, message, data, timestamp: new Date() }]);
  };

  const runTests = async () => {
    setLoading(true);
    setTestResults([]);

    // Test 1: Check authentication
    addResult('Authentication', !!currentUser, 
      currentUser ? `Logged in as: ${currentUser.email}` : 'Not logged in');

    if (!currentUser) {
      setLoading(false);
      return;
    }

    // Test 2: Test basic Firestore write
    try {
      const testDoc = await addDoc(collection(db, 'test'), {
        message: 'Test write',
        timestamp: serverTimestamp(),
        userId: currentUser.uid
      });
      addResult('Firestore Write', true, `Test document created: ${testDoc.id}`);
    } catch (error) {
      addResult('Firestore Write', false, `Error: ${error.message}`);
    }

    // Test 3: Test reading courses
    try {
      const courses = await getCourses();
      addResult('Read Courses', true, `Found ${courses.length} courses`, courses);
    } catch (error) {
      addResult('Read Courses', false, `Error: ${error.message}`);
    }

    // Test 4: Test creating a meeting (if there are courses)
    try {
      const courses = await getCourses();
      if (courses.length > 0) {
        const testCourse = courses[0];
        const meetingData = {
          courseId: testCourse.id,
          title: 'Test Meeting from Debug Page',
          description: 'This is a test meeting',
          scheduledTime: new Date(Date.now() + 60000), // 1 minute from now
          hostId: currentUser.uid,
          hostName: currentUser.displayName || currentUser.email,
          hostEmail: currentUser.email,
          allowedEmails: [],
          isActive: false,
          participants: [currentUser.uid]
        };

        const meetingId = await createMeeting(meetingData);
        addResult('Create Meeting', true, `Meeting created: ${meetingId}`, { meetingId, courseId: testCourse.id });

        // Test 5: Test reading meetings
        const meetings = await getMeetings(testCourse.id);
        addResult('Read Meetings', true, `Found ${meetings.length} meetings for course`, meetings);
      } else {
        addResult('Create Meeting', false, 'No courses found to create meeting in');
      }
    } catch (error) {
      addResult('Create Meeting', false, `Error: ${error.message}`);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Firebase Connection Test</h1>
          
          <div className="mb-6">
            <button
              onClick={runTests}
              disabled={loading}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
            >
              {loading ? 'Running Tests...' : 'Run Firebase Tests'}
            </button>
          </div>

          {testResults.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800">Test Results:</h2>
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-l-4 ${
                    result.success 
                      ? 'bg-green-50 border-green-400 text-green-800' 
                      : 'bg-red-50 border-red-400 text-red-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{result.test}</h3>
                    <span className="text-sm">{result.timestamp.toLocaleTimeString()}</span>
                  </div>
                  <p className="mt-1">{result.message}</p>
                  {result.data && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm">Show Data</summary>
                      <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FirebaseTestPage;