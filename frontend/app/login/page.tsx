'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import axios from 'axios';

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await axios.post('http://localhost:8000/api/v1/auth/login', null, {
        params: formData,
      });
      localStorage.setItem('access_token', response.data.access_token);
      toast.success('Welcome back!');
      setTimeout(() => router.push('/'), 800);
    } catch (error: unknown) {
      const detail = axios.isAxiosError(error)
        ? error.response?.data?.detail
        : undefined;
      toast.error(detail || 'Login failed. Please try again.');
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

        <h1 className="text-3xl font-semibold text-center mb-2 text-white">Sign in</h1>
        <p className="text-white/60 text-center mb-10">Access your Nova collaborative workspace</p>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm mb-2 text-white/80">Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full px-5 py-4 rounded-2xl bg-white/10 border border-white/20 focus:outline-none focus:border-sky-400 text-white placeholder:text-white/50"
              placeholder="your_username"
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
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-gradient-to-r from-sky-500 to-indigo-600 rounded-2xl font-semibold text-base hover:brightness-110 transition-all disabled:opacity-70 text-white"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-center mt-8 text-white/60">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-sky-400 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}