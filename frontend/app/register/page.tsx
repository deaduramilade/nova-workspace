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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 flex items-center justify-center p-6">
      <Toaster position="top-center" />

      <div className="glass w-full max-w-md rounded-3xl p-10">
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-2xl flex items-center justify-center">
            <span className="text-white text-4xl font-bold">N</span>
          </div>
        </div>

        <h1 className="text-3xl font-semibold text-center mb-2">Create Account</h1>
        <p className="text-white/60 text-center mb-10">Join the Nova collaborative platform</p>

        <form onSubmit={handleRegister} className="space-y-6">
          <div>
            <label className="block text-sm mb-2 text-white/80">Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full px-5 py-4 rounded-2xl bg-white/10 border border-white/20 focus:outline-none focus:border-sky-400 text-white placeholder:text-white/50"
              placeholder="new_user"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-2 text-white/80">Email Address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-5 py-4 rounded-2xl bg-white/10 border border-white/20 focus:outline-none focus:border-sky-400 text-white placeholder:text-white/50"
              placeholder="samuel@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-2 text-white/80">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-5 py-4 rounded-2xl bg-white/10 border border-white/20 focus:outline-none focus:border-sky-400 text-white placeholder:text-white/50"
              placeholder="Create a strong password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-gradient-to-r from-sky-500 to-indigo-600 rounded-2xl font-semibold text-base hover:brightness-110 transition-all disabled:opacity-70"
          >
            {isLoading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center mt-8 text-white/60">
          Already have an account?{' '}
          <Link href="/login" className="text-sky-400 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}