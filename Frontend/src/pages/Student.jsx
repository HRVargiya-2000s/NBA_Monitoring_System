import React from 'react';
import { Outlet } from 'react-router';
import StudentNavbar from '../components/StudentNavbar'; // Make sure path is correct

const Student = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <StudentNavbar />
      <main className="p-6">
        {/* The Dashboard, Subjects, etc. will magically appear right here! */}
        <Outlet /> 
      </main>
    </div>
  );
};

export default Student;