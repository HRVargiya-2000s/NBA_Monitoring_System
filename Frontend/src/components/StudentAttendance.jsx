import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || import.meta.env.SERVER_URL || 'http://localhost:3000';

const StudentAttendance = () => {
  const [attendanceStats, setAttendanceStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        setLoading(true);
        const userRes = await axios.get(`${SERVER_URL}/user/me`, { withCredentials: true });
        const userData = userRes.data.user || userRes.data;
        const enrollment_no = userData.id || userData.enrollment_no;

        const attRes = await axios.get(`${SERVER_URL}/attendance/report/${enrollment_no}`, { withCredentials: true });
        
        let reportData = [];
        if (Array.isArray(attRes.data)) {
            reportData = attRes.data;
        } else if (attRes.data && Array.isArray(attRes.data.data)) {
            reportData = attRes.data.data;
        }

        // Aggregate by subject
        const grouped = {};
        reportData.forEach((row) => {
            const key = row.subject_code;
            if (!grouped[key]) {
                grouped[key] = {
                    subject_name: row.subject_name,
                    subject_code: row.subject_code,
                    total: 0,
                    attended: 0
                };
            }
            grouped[key].total += 1;
            if (row.status === 'PRESENT') {
                grouped[key].attended += 1;
            }
        });

        setAttendanceStats(Object.values(grouped));
      } catch (err) {
        setError(err?.response?.data?.message || err.message || 'Failed to fetch attendance');
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 p-8 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-white rounded-lg shadow-sm border border-red-200 overflow-hidden">
        <h2 className="text-2xl font-bold text-red-700 mb-4">Error</h2>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Attendance Record</h2>
      {attendanceStats.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No attendance records found.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Subject</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Total Classes</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Attended</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Percentage</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {attendanceStats.map((record, idx) => {
                const percentage = record.total > 0 ? ((record.attended / record.total) * 100).toFixed(2) : 0;
                
                return (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-slate-800">{record.subject_name}</div>
                      <div className="text-xs text-slate-500 mt-1">{record.subject_code}</div>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-slate-700 font-medium">
                      {record.total}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-slate-700 font-medium">
                      {record.attended}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1.5 inline-flex text-xs leading-none font-bold rounded-full border ${percentage >= 75 ? 'bg-green-50 text-green-700 border-green-200' : (percentage >= 60 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-red-50 text-red-700 border-red-200')}`}>
                        {percentage}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StudentAttendance;