import React from 'react';
import { Link } from 'react-router-dom';
import LoginForm from '../../components/forms/LoginForm';

const Login = () => {
  return (
    <div className="flex flex-col items-center">
       <LoginForm />
       
       <div className="auth-copy mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm text-slate-600">
         Don't have an account yet?{' '}
         <Link to="/auth/signup" className="font-semibold text-primary hover:text-primary-dark transition-colors">
            Register your company
         </Link>
       </div>
    </div>
  );
};

export default Login;
