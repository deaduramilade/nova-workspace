'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import axios from 'axios';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await axios.post('http://localhost:8000/api/v1/auth/register', formData);
      toast.success("Account created successfully. You can now sign in.");
      setTimeout(() => window.location.href = '/login', 1500);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-readable">
      <Toaster position="top-center" />

      <div className="glass w-full max-w-md rounded-2xl p-8 sm:p-10">
        <div className="flex justify-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-500/20">
            <span className="text-white text-3xl font-bold">N</span>
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-center mb-2">Create Account</h1>
        <p className="text-readable-muted text-center mb-8 text-sm">Join the Nova collaborative platform</p>

        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label className="block text-sm mb-2 text-readable-muted">Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-sky-400/60 focus:ring-1 focus:ring-sky-400/30 text-readable placeholder:text-readable-subtle transition-colors"
              placeholder="new_user"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-2 text-readable-muted">Email Address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-sky-400/60 focus:ring-1 focus:ring-sky-400/30 text-readable placeholder:text-readable-subtle transition-colors"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-2 text-readable-muted">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-sky-400/60 focus:ring-1 focus:ring-sky-400/30 text-readable placeholder:text-readable-subtle transition-colors"
              placeholder="Create a strong password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 btn-primary rounded-xl font-semibold text-sm text-white disabled:opacity-70"
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-readable-muted">
          Already have an account?{' '}
          <Link href="/login" className="text-sky-400 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}