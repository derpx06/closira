import React from 'react';
import { Link } from 'react-router-dom';
import SignupForm from '../../components/forms/SignupForm';

const Signup = () => {
  return (
    <div className="flex flex-col items-center">
       <SignupForm />
       
       <div className="auth-copy mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm text-slate-600">
         Already have an account?{' '}
         <Link to="/auth/login" className="font-semibold text-primary hover:text-primary-dark transition-colors">
            Sign in here
         </Link>
       </div>
    </div>
  );
};

export default Signup;
